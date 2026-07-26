begin;

create table littlearc.file_derivatives (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  source_file_object_id uuid not null,
  kind text not null check (kind = 'validation_preview'),
  policy_version integer not null check (policy_version = 1),
  state text not null check (
    state in ('pending','queued','rendering','result_pending_cleanup','ready','failed')
  ),
  storage_key text,
  ciphertext_bytes integer check (ciphertext_bytes is null or ciphertext_bytes between 1 and 1048576),
  ciphertext_sha256 text check (
    ciphertext_sha256 is null or ciphertext_sha256 ~ '^[0-9a-f]{64}$'
  ),
  wrapped_file_key bytea,
  wrap_nonce bytea,
  content_nonce bytea,
  auth_tag bytea,
  key_version integer,
  aad_version integer not null default 1 check (aad_version = 1),
  detected_mime text check (detected_mime is null or detected_mime = 'image/jpeg'),
  pixel_width integer,
  pixel_height integer,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  attempt_id uuid,
  lease_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  safe_error_code text check (
    safe_error_code is null or safe_error_code in (
      'renderer_unavailable','render_failed','resource_limit_exceeded',
      'output_too_large','output_invalid','scanner_unavailable',
      'encryption_failed','storage_integrity_mismatch',
      'plaintext_cleanup_retry','preview_retry_exhausted'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint file_derivatives_source_fk foreign key (household_id, source_file_object_id)
    references littlearc.file_objects(household_id, id) on delete restrict,
  constraint file_derivatives_source_kind_policy_unique
    unique (source_file_object_id, kind, policy_version),
  constraint file_derivatives_storage_key_unique unique (storage_key),
  constraint file_derivatives_crypto_check check (
    (wrapped_file_key is null and wrap_nonce is null and content_nonce is null
      and auth_tag is null and key_version is null)
    or (octet_length(wrapped_file_key) = 48 and octet_length(wrap_nonce) = 12
      and octet_length(content_nonce) = 12 and octet_length(auth_tag) = 16
      and key_version > 0)
  ),
  constraint file_derivatives_dimensions_check check (
    (pixel_width is null and pixel_height is null)
    or (pixel_width between 1 and 1600 and pixel_height between 1 and 1600)
  )
);

create index file_derivatives_queue_idx
  on littlearc.file_derivatives (state, lease_expires_at, updated_at)
  where state in ('pending','queued','rendering','result_pending_cleanup');

alter table littlearc.file_derivatives enable row level security;
alter table littlearc.file_derivatives force row level security;

create policy file_derivatives_tenant_isolation on littlearc.file_derivatives
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());

grant select on littlearc.file_derivatives to littlearc_app;
revoke all on littlearc.file_derivatives from littlearc_worker;

create or replace function littlearc.list_eligible_file_preview_sources(batch_size integer)
returns table (source_file_object_id uuid)
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  select object.id
  from littlearc.file_objects object
  where object.deleted_at is null
    and object.upload_state = 'uploaded'
    and object.validation_state = 'ready'
    and object.malware_state = 'clean'
    and object.detected_mime in ('image/jpeg','image/png','image/heic','application/pdf')
    and not exists (
      select 1 from littlearc.file_derivatives derivative
      where derivative.source_file_object_id = object.id
        and derivative.kind = 'validation_preview'
        and derivative.policy_version = 1
    )
  order by object.updated_at, object.id
  limit greatest(1, least(batch_size, 100))
$$;

create or replace function littlearc.ensure_file_preview_candidate(
  claimed_source_file_object_id uuid,
  proposed_derivative_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, littlearc
as $$
declare
  result_id uuid;
  result_household_id uuid;
begin
  insert into littlearc.file_derivatives (
    id, household_id, source_file_object_id, kind, policy_version, state
  )
  select proposed_derivative_id, object.household_id, object.id,
    'validation_preview', 1, 'queued'
  from littlearc.file_objects object
  where object.id = claimed_source_file_object_id
    and object.deleted_at is null
    and object.upload_state = 'uploaded'
    and object.validation_state = 'ready'
    and object.malware_state = 'clean'
    and object.detected_mime in ('image/jpeg','image/png','image/heic','application/pdf')
  on conflict (source_file_object_id, kind, policy_version) do nothing;

  select derivative.id, derivative.household_id
  into result_id, result_household_id
  from littlearc.file_derivatives derivative
  where derivative.source_file_object_id = claimed_source_file_object_id
    and derivative.kind = 'validation_preview'
    and derivative.policy_version = 1
    and derivative.deleted_at is null;

  if result_id is not null then
    insert into littlearc.outbox_events (
      id, household_id, event_type, aggregate_type, aggregate_id, payload
    ) values (
      result_id, result_household_id, 'file_preview_requested',
      'file_derivative', result_id, jsonb_build_object('derivativeId', result_id)
    )
    on conflict (id) do nothing;
    update littlearc.file_objects
    set preview_state = case
          when preview_state = 'not_authorized' then 'pending'
          else preview_state
        end,
        updated_at = now()
    where id = claimed_source_file_object_id;
  end if;
  return result_id;
end
$$;

create or replace function littlearc.claim_file_preview_outbox(batch_size integer)
returns table (event_id uuid, derivative_id uuid)
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with claimed as (
    select event.id, event.aggregate_id
    from littlearc.outbox_events event
    where event.event_type = 'file_preview_requested'
      and event.aggregate_type = 'file_derivative'
      and event.dispatched_at is null
      and event.available_at <= now()
      and event.payload = jsonb_build_object('derivativeId', event.aggregate_id)
    order by event.available_at, event.id
    for update skip locked
    limit greatest(1, least(batch_size, 100))
  ),
  marked as (
    update littlearc.outbox_events event
    set attempts = attempts + 1, last_error = null
    from claimed
    where event.id = claimed.id
    returning event.id, event.aggregate_id
  )
  select id, aggregate_id from marked
$$;

create or replace function littlearc.finish_file_preview_outbox(
  claimed_event_id uuid,
  dispatch_succeeded boolean
)
returns void
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  update littlearc.outbox_events
  set dispatched_at = case when dispatch_succeeded then now() else null end,
      available_at = case
        when dispatch_succeeded then available_at
        else now() + least(interval '15 minutes', interval '30 seconds' * power(2, least(attempts, 5)))
      end,
      last_error = case when dispatch_succeeded then null else 'dispatch_retry' end
  where id = claimed_event_id
    and event_type = 'file_preview_requested'
    and dispatched_at is null
$$;

create or replace function littlearc.claim_file_preview(
  claimed_derivative_id uuid,
  claimed_attempt_id uuid,
  lease_seconds integer
)
returns table (
  derivative_id uuid,
  source_file_object_id uuid,
  household_id uuid,
  source_object_key text,
  source_ciphertext_bytes integer,
  source_ciphertext_sha256 text,
  source_mime text,
  source_wrapped_file_key bytea,
  source_wrap_nonce bytea,
  source_content_nonce bytea,
  source_auth_tag bytea,
  source_key_version integer,
  source_aad_version integer,
  wrapped_household_key bytea,
  household_wrap_nonce bytea,
  household_key_version integer,
  household_wrapping_key_version integer
)
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with claimed as (
    update littlearc.file_derivatives derivative
    set state = 'rendering',
        attempt_id = claimed_attempt_id,
        attempt_count = attempt_count + 1,
        lease_expires_at = now() + make_interval(secs => greatest(30, least(lease_seconds, 900))),
        started_at = coalesce(started_at, now()),
        safe_error_code = null,
        updated_at = now()
    from littlearc.file_objects object
    where derivative.id = claimed_derivative_id
      and derivative.source_file_object_id = object.id
      and derivative.household_id = object.household_id
      and derivative.deleted_at is null
      and derivative.state = 'queued'
      and object.deleted_at is null
      and object.validation_state = 'ready'
      and object.malware_state = 'clean'
      and object.detected_mime in ('image/jpeg','image/png','image/heic','application/pdf')
    returning derivative.*, object.storage_key as source_object_key,
      object.ciphertext_bytes as source_ciphertext_bytes,
      object.ciphertext_sha256 as source_ciphertext_sha256,
      object.detected_mime as source_mime,
      object.wrapped_file_key as source_wrapped_file_key,
      object.wrap_nonce as source_wrap_nonce,
      object.content_nonce as source_content_nonce,
      object.auth_tag as source_auth_tag,
      object.key_version as source_key_version,
      object.aad_version as source_aad_version
  ),
  projected as (
    update littlearc.file_objects object
    set preview_state = 'processing', updated_at = now()
    from claimed
    where object.id = claimed.source_file_object_id
    returning object.id
  )
  select claimed.id, claimed.source_file_object_id, claimed.household_id,
    claimed.source_object_key, claimed.source_ciphertext_bytes,
    claimed.source_ciphertext_sha256, claimed.source_mime,
    claimed.source_wrapped_file_key, claimed.source_wrap_nonce,
    claimed.source_content_nonce, claimed.source_auth_tag,
    claimed.source_key_version, claimed.source_aad_version,
    household_key.wrapped_key, household_key.wrap_nonce,
    household_key.key_version, household_key.wrapping_key_version
  from claimed
  cross join (select count(*) from projected) projection
  join lateral (
    select key.*
    from littlearc.household_keys key
    where key.household_id = claimed.household_id and key.status = 'active'
    order by key.key_version desc
    limit 1
  ) household_key on true
$$;

create or replace function littlearc.heartbeat_file_preview(
  claimed_derivative_id uuid,
  claimed_attempt_id uuid,
  lease_seconds integer
)
returns boolean
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with updated as (
    update littlearc.file_derivatives
    set lease_expires_at = now() + make_interval(secs => greatest(30, least(lease_seconds, 900))),
        updated_at = now()
    where id = claimed_derivative_id
      and attempt_id = claimed_attempt_id
      and state in ('rendering','result_pending_cleanup')
    returning 1
  )
  select exists(select 1 from updated)
$$;

create or replace function littlearc.propose_file_preview_result(
  claimed_derivative_id uuid,
  claimed_attempt_id uuid,
  proposed_storage_key text,
  proposed_ciphertext_bytes integer,
  proposed_ciphertext_sha256 text,
  proposed_wrapped_file_key bytea,
  proposed_wrap_nonce bytea,
  proposed_content_nonce bytea,
  proposed_auth_tag bytea,
  proposed_key_version integer,
  proposed_pixel_width integer,
  proposed_pixel_height integer
)
returns boolean
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with updated as (
    update littlearc.file_derivatives
    set state = 'result_pending_cleanup',
        storage_key = proposed_storage_key,
        ciphertext_bytes = proposed_ciphertext_bytes,
        ciphertext_sha256 = proposed_ciphertext_sha256,
        wrapped_file_key = proposed_wrapped_file_key,
        wrap_nonce = proposed_wrap_nonce,
        content_nonce = proposed_content_nonce,
        auth_tag = proposed_auth_tag,
        key_version = proposed_key_version,
        detected_mime = 'image/jpeg',
        pixel_width = proposed_pixel_width,
        pixel_height = proposed_pixel_height,
        safe_error_code = null,
        updated_at = now()
    where id = claimed_derivative_id
      and attempt_id = claimed_attempt_id
      and state = 'rendering'
    returning 1
  )
  select exists(select 1 from updated)
$$;

create or replace function littlearc.commit_file_preview_result(
  claimed_derivative_id uuid,
  claimed_attempt_id uuid
)
returns boolean
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with updated as (
    update littlearc.file_derivatives
    set state = 'ready', attempt_id = null, lease_expires_at = null,
        completed_at = now(), updated_at = now()
    where id = claimed_derivative_id
      and attempt_id = claimed_attempt_id
      and state = 'result_pending_cleanup'
      and storage_key is not null and ciphertext_bytes is not null
      and ciphertext_sha256 is not null and wrapped_file_key is not null
    returning source_file_object_id
  )
  update littlearc.file_objects object
  set preview_state = 'ready', updated_at = now()
  from updated
  where object.id = updated.source_file_object_id
  returning true
$$;

create or replace function littlearc.retry_file_preview(
  claimed_derivative_id uuid,
  claimed_attempt_id uuid,
  retry_safe_error_code text
)
returns boolean
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with updated as (
    update littlearc.file_derivatives
    set state = case
          when retry_safe_error_code = 'plaintext_cleanup_retry' then state
          else 'queued'
        end,
        attempt_id = case
          when retry_safe_error_code = 'plaintext_cleanup_retry' then attempt_id
          else null
        end,
        lease_expires_at = case
          when retry_safe_error_code = 'plaintext_cleanup_retry' then now() + interval '5 minutes'
          else null
        end,
        safe_error_code = retry_safe_error_code,
        updated_at = now()
    where id = claimed_derivative_id
      and attempt_id = claimed_attempt_id
      and state in ('rendering','result_pending_cleanup')
    returning 1
  )
  select exists(select 1 from updated)
$$;

create or replace function littlearc.fail_exhausted_file_preview(claimed_derivative_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with updated as (
    update littlearc.file_derivatives
    set state = 'failed', attempt_id = null, lease_expires_at = null,
        safe_error_code = 'preview_retry_exhausted',
        completed_at = now(), updated_at = now()
    where id = claimed_derivative_id and state = 'queued' and attempt_id is null
    returning source_file_object_id
  )
  update littlearc.file_objects object
  set preview_state = 'failed', updated_at = now()
  from updated
  where object.id = updated.source_file_object_id
  returning true
$$;

create or replace function littlearc.fail_file_preview(
  claimed_derivative_id uuid,
  claimed_attempt_id uuid,
  failure_safe_error_code text
)
returns boolean
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with updated as (
    update littlearc.file_derivatives
    set state = 'failed', attempt_id = null, lease_expires_at = null,
        safe_error_code = failure_safe_error_code,
        completed_at = now(), updated_at = now()
    where id = claimed_derivative_id
      and attempt_id = claimed_attempt_id
      and state = 'rendering'
      and failure_safe_error_code in ('output_too_large','output_invalid')
    returning source_file_object_id
  )
  update littlearc.file_objects object
  set preview_state = 'failed', updated_at = now()
  from updated
  where object.id = updated.source_file_object_id
  returning true
$$;

create or replace function littlearc.list_stale_file_preview_attempts(batch_size integer)
returns table (derivative_id uuid, attempt_id uuid, storage_key text)
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  select id, attempt_id, storage_key
  from littlearc.file_derivatives
  where state in ('rendering','result_pending_cleanup')
    and attempt_id is not null and lease_expires_at <= now()
  order by lease_expires_at, id
  limit greatest(1, least(batch_size, 100))
$$;

create or replace function littlearc.recover_stale_file_preview(
  claimed_derivative_id uuid,
  claimed_attempt_id uuid
)
returns boolean
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with updated as (
    update littlearc.file_derivatives
    set state = 'queued', storage_key = null, ciphertext_bytes = null,
        ciphertext_sha256 = null, wrapped_file_key = null, wrap_nonce = null,
        content_nonce = null, auth_tag = null, key_version = null,
        detected_mime = null, pixel_width = null, pixel_height = null,
        attempt_id = null, lease_expires_at = null, safe_error_code = null,
        updated_at = now()
    where id = claimed_derivative_id
      and attempt_id = claimed_attempt_id
      and state in ('rendering','result_pending_cleanup')
      and lease_expires_at <= now()
    returning 1
  )
  select exists(select 1 from updated)
$$;

create or replace function littlearc.read_file_preview_grant(
  requested_file_object_id uuid,
  requested_device_id uuid
)
returns table (
  derivative_id uuid,
  source_file_object_id uuid,
  household_id uuid,
  storage_key text,
  ciphertext_bytes integer,
  ciphertext_sha256 text,
  wrapped_file_key bytea,
  wrap_nonce bytea,
  content_nonce bytea,
  auth_tag bytea,
  key_version integer,
  aad_version integer,
  policy_version integer
)
language sql
set search_path = pg_catalog, littlearc
as $$
  select derivative.id, derivative.source_file_object_id, derivative.household_id,
    derivative.storage_key, derivative.ciphertext_bytes, derivative.ciphertext_sha256,
    derivative.wrapped_file_key, derivative.wrap_nonce, derivative.content_nonce,
    derivative.auth_tag, derivative.key_version, derivative.aad_version,
    derivative.policy_version
  from littlearc.file_derivatives derivative
  join littlearc.file_objects object
    on object.id = derivative.source_file_object_id
    and object.household_id = derivative.household_id
  where object.id = requested_file_object_id
    and object.deleted_at is null
    and object.validation_state = 'ready'
    and object.malware_state = 'clean'
    and derivative.deleted_at is null
    and derivative.state = 'ready'
    and derivative.storage_key is not null
    and exists (
      select 1 from littlearc.devices device
      where device.id = requested_device_id
        and device.household_id = derivative.household_id
        and device.user_id = current_setting('littlearc.current_identity_user_id', true)
        and device.enrollment_status = 'active'
        and device.revoked_at is null
    )
  limit 1
$$;

revoke all on function littlearc.list_eligible_file_preview_sources(integer) from public;
revoke all on function littlearc.ensure_file_preview_candidate(uuid, uuid) from public;
revoke all on function littlearc.claim_file_preview_outbox(integer) from public;
revoke all on function littlearc.finish_file_preview_outbox(uuid, boolean) from public;
revoke all on function littlearc.claim_file_preview(uuid, uuid, integer) from public;
revoke all on function littlearc.heartbeat_file_preview(uuid, uuid, integer) from public;
revoke all on function littlearc.propose_file_preview_result(
  uuid, uuid, text, integer, text, bytea, bytea, bytea, bytea, integer, integer, integer
) from public;
revoke all on function littlearc.commit_file_preview_result(uuid, uuid) from public;
revoke all on function littlearc.retry_file_preview(uuid, uuid, text) from public;
revoke all on function littlearc.fail_exhausted_file_preview(uuid) from public;
revoke all on function littlearc.fail_file_preview(uuid, uuid, text) from public;
revoke all on function littlearc.list_stale_file_preview_attempts(integer) from public;
revoke all on function littlearc.recover_stale_file_preview(uuid, uuid) from public;
revoke all on function littlearc.read_file_preview_grant(uuid, uuid) from public;

grant execute on function littlearc.list_eligible_file_preview_sources(integer) to littlearc_worker;
grant execute on function littlearc.ensure_file_preview_candidate(uuid, uuid) to littlearc_worker;
grant execute on function littlearc.claim_file_preview_outbox(integer) to littlearc_worker;
grant execute on function littlearc.finish_file_preview_outbox(uuid, boolean) to littlearc_worker;
grant execute on function littlearc.claim_file_preview(uuid, uuid, integer) to littlearc_worker;
grant execute on function littlearc.heartbeat_file_preview(uuid, uuid, integer) to littlearc_worker;
grant execute on function littlearc.propose_file_preview_result(
  uuid, uuid, text, integer, text, bytea, bytea, bytea, bytea, integer, integer, integer
) to littlearc_worker;
grant execute on function littlearc.commit_file_preview_result(uuid, uuid) to littlearc_worker;
grant execute on function littlearc.retry_file_preview(uuid, uuid, text) to littlearc_worker;
grant execute on function littlearc.fail_exhausted_file_preview(uuid) to littlearc_worker;
grant execute on function littlearc.fail_file_preview(uuid, uuid, text) to littlearc_worker;
grant execute on function littlearc.list_stale_file_preview_attempts(integer) to littlearc_worker;
grant execute on function littlearc.recover_stale_file_preview(uuid, uuid) to littlearc_worker;
grant execute on function littlearc.read_file_preview_grant(uuid, uuid) to littlearc_app;

insert into littlearc.schema_migrations (version, checksum_sha256)
values ('0008_vlt_05_f3_file_previews', 'bb7e5a0164bbf314e4a9679443579ace24cc58a0a617416325f715a04483e78d')
on conflict (version) do nothing;

commit;

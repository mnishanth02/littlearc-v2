export const vlt05FileValidationMigration = {
  description: "VLT-05 worker-side file validation state and least-authority functions",
  filename: "0007_vlt_05_file_validation.sql",
  version: "0007_vlt_05_file_validation",
} as const;

export const vlt05FileValidationMigrationSql = `
begin;

alter table littlearc.file_objects
  drop constraint file_objects_validation_state_check;

alter table littlearc.file_objects
  add constraint file_objects_validation_state_check check (
    validation_state in (
      'pending','queued','validating','result_pending_cleanup','ready','rejected','failed'
    )
  ),
  add column malware_state text not null default 'pending' check (
    malware_state in ('pending','clean','detected','unavailable','error')
  ),
  add column preview_state text not null default 'not_authorized' check (
    preview_state in ('not_authorized','pending','processing','ready','failed')
  ),
  add column detected_mime text check (
    detected_mime is null or detected_mime in (
      'image/jpeg','image/png','image/heic','application/pdf'
    )
  ),
  add column page_count integer check (
    page_count is null or page_count between 1 and 50
  ),
  add column validation_policy_version integer check (
    validation_policy_version is null or validation_policy_version > 0
  ),
  add column validation_attempt_count integer not null default 0 check (
    validation_attempt_count >= 0
  ),
  add column validation_attempt_id uuid,
  add column validation_lease_expires_at timestamptz,
  add column validation_started_at timestamptz,
  add column validation_completed_at timestamptz,
  add column validation_safe_error_code text check (
    validation_safe_error_code is null or validation_safe_error_code in (
      'type_mismatch','unsupported_format','malformed_structure',
      'resource_limit_exceeded','ciphertext_integrity_mismatch',
      'authenticated_decryption_failed','pdf_encrypted','pdf_active_content',
      'pdf_embedded_content','malware_detected','scanner_unavailable',
      'scanner_signatures_stale','plaintext_cleanup_retry',
      'validation_retry_exhausted'
    )
  );

create index file_objects_validation_queue_idx
  on littlearc.file_objects (validation_state, validation_lease_expires_at, updated_at)
  where validation_state in ('pending','queued','validating','result_pending_cleanup');

revoke select, insert, update on littlearc.outbox_events from littlearc_worker;

create or replace function littlearc.claim_file_validation_outbox(batch_size integer)
returns table (
  event_id uuid,
  file_object_id uuid
)
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with claimed as (
    select event.id, event.aggregate_id
    from littlearc.outbox_events event
    where event.event_type = 'file_validation_requested'
      and event.aggregate_type = 'file_object'
      and event.dispatched_at is null
      and event.available_at <= now()
      and event.payload = jsonb_build_object('fileObjectId', event.aggregate_id)
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
  update littlearc.file_objects object
  set validation_state = case
        when object.validation_state = 'pending' then 'queued'
        else object.validation_state
      end,
      updated_at = now()
  from marked
  where object.id = marked.aggregate_id
  returning marked.id, marked.aggregate_id
$$;

create or replace function littlearc.finish_file_validation_outbox(
  claimed_event_id uuid,
  dispatch_succeeded boolean
)
returns void
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  update littlearc.outbox_events
  set
    dispatched_at = case when dispatch_succeeded then now() else null end,
    available_at = case
      when dispatch_succeeded then available_at
      else now() + least(interval '15 minutes', interval '30 seconds' * power(2, least(attempts, 5)))
    end,
    last_error = case when dispatch_succeeded then null else 'dispatch_retry' end
  where id = claimed_event_id
    and event_type = 'file_validation_requested'
    and dispatched_at is null
$$;

create or replace function littlearc.claim_file_validation(
  claimed_file_object_id uuid,
  claimed_attempt_id uuid,
  lease_seconds integer
)
returns table (
  file_object_id uuid,
  household_id uuid,
  object_key text,
  ciphertext_bytes integer,
  ciphertext_sha256 text,
  declared_mime text,
  wrapped_file_key bytea,
  file_wrap_nonce bytea,
  content_nonce bytea,
  auth_tag bytea,
  file_key_version integer,
  aad_version integer,
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
    update littlearc.file_objects object
    set validation_state = 'validating',
        validation_attempt_id = claimed_attempt_id,
        validation_attempt_count = validation_attempt_count + 1,
        validation_lease_expires_at =
          now() + make_interval(secs => greatest(30, least(lease_seconds, 900))),
        validation_started_at = coalesce(validation_started_at, now()),
        validation_safe_error_code = null,
        updated_at = now()
    where object.id = claimed_file_object_id
      and object.deleted_at is null
      and object.validation_state = 'queued'
      and (
        object.validation_lease_expires_at is null
        or object.validation_lease_expires_at <= now()
      )
    returning object.*
  )
  select
    claimed.id,
    claimed.household_id,
    claimed.storage_key,
    claimed.ciphertext_bytes,
    claimed.ciphertext_sha256,
    claimed.declared_mime,
    claimed.wrapped_file_key,
    claimed.wrap_nonce,
    claimed.content_nonce,
    claimed.auth_tag,
    claimed.key_version,
    claimed.aad_version,
    household_key.wrapped_key,
    household_key.wrap_nonce,
    household_key.key_version,
    household_key.wrapping_key_version
  from claimed
  join lateral (
    select key.*
    from littlearc.household_keys key
    where key.household_id = claimed.household_id and key.status = 'active'
    order by key.key_version desc
    limit 1
  ) household_key on true
$$;

create or replace function littlearc.heartbeat_file_validation(
  claimed_file_object_id uuid,
  claimed_attempt_id uuid,
  lease_seconds integer
)
returns boolean
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with updated as (
    update littlearc.file_objects
    set validation_lease_expires_at =
          now() + make_interval(secs => greatest(30, least(lease_seconds, 900))),
        updated_at = now()
    where id = claimed_file_object_id
      and validation_attempt_id = claimed_attempt_id
      and validation_state in ('validating','result_pending_cleanup')
    returning 1
  )
  select exists(select 1 from updated)
$$;

create or replace function littlearc.propose_file_validation_result(
  claimed_file_object_id uuid,
  claimed_attempt_id uuid,
  proposed_terminal_state text,
  proposed_malware_state text,
  proposed_detected_mime text,
  proposed_page_count integer,
  proposed_safe_error_code text,
  proposed_policy_version integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, littlearc
as $$
begin
  if proposed_terminal_state not in ('ready','rejected','failed') then
    raise exception 'invalid terminal state';
  end if;
  if proposed_malware_state not in ('pending','clean','detected','unavailable','error') then
    raise exception 'invalid malware state';
  end if;
  update littlearc.file_objects
  set validation_state = 'result_pending_cleanup',
      malware_state = proposed_malware_state,
      detected_mime = proposed_detected_mime,
      page_count = proposed_page_count,
      validation_safe_error_code = proposed_safe_error_code,
      validation_policy_version = proposed_policy_version,
      updated_at = now()
  where id = claimed_file_object_id
    and validation_attempt_id = claimed_attempt_id
    and validation_state = 'validating';
  return found;
end
$$;

create or replace function littlearc.commit_file_validation_result(
  claimed_file_object_id uuid,
  claimed_attempt_id uuid,
  committed_terminal_state text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, littlearc
as $$
begin
  if committed_terminal_state not in ('ready','rejected','failed') then
    raise exception 'invalid terminal state';
  end if;
  update littlearc.file_objects
  set validation_state = committed_terminal_state,
      validation_attempt_id = null,
      validation_lease_expires_at = null,
      validation_completed_at = now(),
      updated_at = now()
  where id = claimed_file_object_id
    and validation_attempt_id = claimed_attempt_id
    and validation_state = 'result_pending_cleanup'
    and (
      (committed_terminal_state = 'ready'
        and malware_state = 'clean'
        and validation_safe_error_code is null)
      or committed_terminal_state <> 'ready'
    );
  return found;
end
$$;

create or replace function littlearc.retry_file_validation(
  claimed_file_object_id uuid,
  claimed_attempt_id uuid,
  retry_safe_error_code text
)
returns boolean
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with updated as (
    update littlearc.file_objects
    set validation_state = case
          when retry_safe_error_code = 'plaintext_cleanup_retry'
            then validation_state
          else 'queued'
        end,
        malware_state = case
          when retry_safe_error_code in ('scanner_unavailable','scanner_signatures_stale')
            then 'unavailable'
          else malware_state
        end,
        validation_attempt_id = case
          when retry_safe_error_code = 'plaintext_cleanup_retry'
            then validation_attempt_id
          else null
        end,
        validation_lease_expires_at = case
          when retry_safe_error_code = 'plaintext_cleanup_retry'
            then now() + interval '5 minutes'
          else null
        end,
        validation_safe_error_code = retry_safe_error_code,
        updated_at = now()
    where id = claimed_file_object_id
      and validation_attempt_id = claimed_attempt_id
      and validation_state in ('validating','result_pending_cleanup')
    returning 1
  )
  select exists(select 1 from updated)
$$;

create or replace function littlearc.fail_exhausted_file_validation(
  claimed_file_object_id uuid
)
returns boolean
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with updated as (
    update littlearc.file_objects
    set validation_state = 'failed',
        validation_attempt_id = null,
        validation_lease_expires_at = null,
        validation_safe_error_code = 'validation_retry_exhausted',
        validation_completed_at = now(),
        updated_at = now()
    where id = claimed_file_object_id
      and validation_state = 'queued'
      and validation_attempt_id is null
    returning 1
  )
  select exists(select 1 from updated)
$$;

create or replace function littlearc.list_stale_file_validation_attempts(batch_size integer)
returns table (
  file_object_id uuid,
  attempt_id uuid
)
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  select id, validation_attempt_id
  from littlearc.file_objects
  where validation_state in ('validating','result_pending_cleanup')
    and validation_attempt_id is not null
    and validation_lease_expires_at <= now()
  order by validation_lease_expires_at, id
  limit greatest(1, least(batch_size, 100))
$$;

create or replace function littlearc.recover_stale_file_validation(
  claimed_file_object_id uuid,
  claimed_attempt_id uuid
)
returns boolean
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with updated as (
    update littlearc.file_objects
    set validation_state = 'queued',
        validation_attempt_id = null,
        validation_lease_expires_at = null,
        validation_safe_error_code = null,
        updated_at = now()
    where id = claimed_file_object_id
      and validation_attempt_id = claimed_attempt_id
      and validation_state in ('validating','result_pending_cleanup')
      and validation_lease_expires_at <= now()
    returning 1
  )
  select exists(select 1 from updated)
$$;

revoke all on function littlearc.claim_file_validation_outbox(integer) from public;
revoke all on function littlearc.finish_file_validation_outbox(uuid, boolean) from public;
revoke all on function littlearc.claim_file_validation(uuid, uuid, integer) from public;
revoke all on function littlearc.heartbeat_file_validation(uuid, uuid, integer) from public;
revoke all on function littlearc.propose_file_validation_result(
  uuid, uuid, text, text, text, integer, text, integer
) from public;
revoke all on function littlearc.commit_file_validation_result(uuid, uuid, text) from public;
revoke all on function littlearc.retry_file_validation(uuid, uuid, text) from public;
revoke all on function littlearc.fail_exhausted_file_validation(uuid) from public;
revoke all on function littlearc.list_stale_file_validation_attempts(integer) from public;
revoke all on function littlearc.recover_stale_file_validation(uuid, uuid) from public;

grant execute on function littlearc.claim_file_validation_outbox(integer) to littlearc_worker;
grant execute on function littlearc.finish_file_validation_outbox(uuid, boolean) to littlearc_worker;
grant execute on function littlearc.claim_file_validation(uuid, uuid, integer) to littlearc_worker;
grant execute on function littlearc.heartbeat_file_validation(uuid, uuid, integer)
  to littlearc_worker;
grant execute on function littlearc.propose_file_validation_result(
  uuid, uuid, text, text, text, integer, text, integer
) to littlearc_worker;
grant execute on function littlearc.commit_file_validation_result(uuid, uuid, text)
  to littlearc_worker;
grant execute on function littlearc.retry_file_validation(uuid, uuid, text) to littlearc_worker;
grant execute on function littlearc.fail_exhausted_file_validation(uuid) to littlearc_worker;
grant execute on function littlearc.list_stale_file_validation_attempts(integer)
  to littlearc_worker;
grant execute on function littlearc.recover_stale_file_validation(uuid, uuid)
  to littlearc_worker;

insert into littlearc.schema_migrations (version, checksum_sha256)
values ('0007_vlt_05_file_validation', '__CHECKSUM_SHA256__')
on conflict (version) do nothing;

commit;
`.trim();

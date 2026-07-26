begin;

alter table littlearc.devices
  add constraint devices_id_household_unique unique (id, household_id);

create table littlearc.upload_sessions (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  created_by uuid not null,
  child_id uuid not null,
  device_id uuid not null,
  file_object_id uuid not null,
  capture_asset_id uuid not null,
  object_key text not null,
  provider_upload_id text not null,
  status text not null check (
    status in ('created','uploading','completing','uploaded','cancelled',
               'expiring','expired','failed')
  ),
  expected_ciphertext_bytes integer not null check (
    expected_ciphertext_bytes > 0 and expected_ciphertext_bytes <= 26214464
  ),
  expected_ciphertext_sha256 text not null check (
    expected_ciphertext_sha256 ~ '^[0-9a-f]{64}$'
  ),
  declared_mime text not null check (
    declared_mime in ('image/jpeg','image/png','image/heic','application/pdf')
  ),
  wrapped_file_key bytea not null check (octet_length(wrapped_file_key) = 48),
  wrap_nonce bytea not null check (octet_length(wrap_nonce) = 12),
  content_nonce bytea not null check (octet_length(content_nonce) = 12),
  auth_tag bytea not null check (octet_length(auth_tag) = 16),
  key_version integer not null check (key_version > 0),
  aad_version integer not null check (aad_version = 1),
  parts jsonb not null default '[]'::jsonb check (jsonb_typeof(parts) = 'array'),
  safe_error_code text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint upload_sessions_household_id_id_unique unique (household_id, id),
  constraint upload_sessions_file_object_unique unique (household_id, file_object_id),
  constraint upload_sessions_object_key_unique unique (object_key),
  constraint upload_sessions_child_fk
    foreign key (household_id, child_id)
    references littlearc.children (household_id, id) on delete restrict,
  constraint upload_sessions_created_by_fk
    foreign key (household_id, created_by)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  constraint upload_sessions_device_fk
    foreign key (device_id, household_id)
    references littlearc.devices (id, household_id) on delete restrict
);
create index upload_sessions_household_status_idx
  on littlearc.upload_sessions (household_id, status, updated_at);
create index upload_sessions_expiry_idx
  on littlearc.upload_sessions (status, expires_at);

create table littlearc.file_objects (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  child_id uuid not null,
  origin_session_id uuid not null,
  storage_key text not null unique,
  ciphertext_bytes integer not null check (
    ciphertext_bytes > 0 and ciphertext_bytes <= 26214464
  ),
  ciphertext_sha256 text not null check (ciphertext_sha256 ~ '^[0-9a-f]{64}$'),
  declared_mime text not null check (
    declared_mime in ('image/jpeg','image/png','image/heic','application/pdf')
  ),
  wrapped_file_key bytea not null check (octet_length(wrapped_file_key) = 48),
  wrap_nonce bytea not null check (octet_length(wrap_nonce) = 12),
  content_nonce bytea not null check (octet_length(content_nonce) = 12),
  auth_tag bytea not null check (octet_length(auth_tag) = 16),
  key_version integer not null check (key_version > 0),
  aad_version integer not null check (aad_version = 1),
  upload_state text not null check (upload_state = 'uploaded'),
  validation_state text not null check (validation_state = 'pending'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint file_objects_household_id_id_unique unique (household_id, id),
  constraint file_objects_origin_session_unique unique (household_id, origin_session_id),
  constraint file_objects_child_fk
    foreign key (household_id, child_id)
    references littlearc.children (household_id, id) on delete restrict,
  constraint file_objects_session_fk
    foreign key (household_id, origin_session_id)
    references littlearc.upload_sessions (household_id, id) on delete restrict
);
create index file_objects_child_created_idx
  on littlearc.file_objects (household_id, child_id, created_at desc);

alter table littlearc.upload_sessions enable row level security;
alter table littlearc.upload_sessions force row level security;
alter table littlearc.file_objects enable row level security;
alter table littlearc.file_objects force row level security;

create policy upload_sessions_tenant_isolation on littlearc.upload_sessions
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());
create policy file_objects_tenant_isolation on littlearc.file_objects
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());

grant select, insert, update on littlearc.upload_sessions to littlearc_app;
grant select, insert, update on littlearc.file_objects to littlearc_app;
revoke delete on littlearc.upload_sessions, littlearc.file_objects from littlearc_app;
revoke all on littlearc.upload_sessions, littlearc.file_objects
from littlearc_worker, littlearc_ops_readonly;

create or replace function littlearc.claim_expired_upload_sessions(batch_size integer)
returns table (
  session_id uuid,
  object_key text,
  provider_upload_id text
)
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  with claimed as (
    select id
    from littlearc.upload_sessions
    where status in ('created','uploading') and expires_at <= now()
    order by expires_at, id
    for update skip locked
    limit greatest(1, least(batch_size, 100))
  )
  update littlearc.upload_sessions session
  set status = 'expiring', updated_at = now()
  from claimed
  where session.id = claimed.id
  returning session.id, session.object_key, session.provider_upload_id
$$;

create or replace function littlearc.finish_expired_upload_session(
  claimed_session_id uuid,
  cleanup_succeeded boolean
)
returns void
language sql
security definer
set search_path = pg_catalog, littlearc
as $$
  update littlearc.upload_sessions
  set
    status = case when cleanup_succeeded then 'expired' else 'uploading' end,
    safe_error_code = case when cleanup_succeeded then null else 'storage_cleanup_retry' end,
    expires_at = case when cleanup_succeeded then expires_at else now() + interval '5 minutes' end,
    updated_at = now()
  where id = claimed_session_id and status = 'expiring'
$$;

revoke all on function littlearc.claim_expired_upload_sessions(integer) from public;
revoke all on function littlearc.finish_expired_upload_session(uuid, boolean) from public;
grant execute on function littlearc.claim_expired_upload_sessions(integer) to littlearc_worker;
grant execute on function littlearc.finish_expired_upload_session(uuid, boolean) to littlearc_worker;

insert into littlearc.schema_migrations (version, checksum_sha256)
values ('0006_vlt_04_file_upload', '344d11851eba749519806c3b182ee081e36c838a36fa48300dd85016c10c888a')
on conflict (version) do nothing;

commit;

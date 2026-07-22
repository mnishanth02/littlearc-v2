export const off02HouseholdMigration = {
  description: "OFF-02 household membership, encrypted profiles, consent, keys, and audit",
  filename: "0003_off_02_household_consent_audit.sql",
  version: "0003_off_02_household_consent_audit",
} as const;

export const off02HouseholdMigrationSql = `
begin;

create or replace function littlearc.current_identity_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('littlearc.current_identity_user_id', true), '');
$$;

alter table littlearc.households
  alter column default_country_code drop default;

create table littlearc.household_memberships (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  user_id text not null references littlearc.auth_user(id) on delete restrict,
  role text not null check (role in ('owner', 'caregiver')),
  status text not null check (status in ('active', 'revoked')),
  invited_by uuid,
  accepted_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint household_memberships_household_id_id_unique unique (household_id, id),
  constraint household_memberships_state_check check (
    (status = 'active' and revoked_at is null) or
    (status = 'revoked' and revoked_at is not null)
  )
);

create unique index household_memberships_one_active_user_idx
  on littlearc.household_memberships (user_id)
  where status = 'active';
create index household_memberships_user_status_idx
  on littlearc.household_memberships (user_id, status);
create index household_memberships_household_status_idx
  on littlearc.household_memberships (household_id, status);

alter table littlearc.households
  add constraint households_owner_membership_fk
  foreign key (id, created_by)
  references littlearc.household_memberships (household_id, id)
  deferrable initially deferred;

create table littlearc.household_keys (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  key_version integer not null check (key_version > 0),
  wrapped_key bytea not null,
  wrap_nonce bytea not null check (octet_length(wrap_nonce) = 12),
  wrapping_key_version integer not null check (wrapping_key_version > 0),
  algorithm text not null check (algorithm = 'AES-256-GCM'),
  status text not null check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint household_keys_household_version_unique unique (household_id, key_version),
  constraint household_keys_state_check check (
    (status = 'active' and retired_at is null) or
    (status = 'retired' and retired_at is not null)
  )
);
create unique index household_keys_one_active_idx
  on littlearc.household_keys (household_id)
  where status = 'active';
create index household_keys_household_status_idx
  on littlearc.household_keys (household_id, status);

create table littlearc.user_profiles (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  user_id text not null references littlearc.auth_user(id) on delete restrict,
  membership_id uuid not null,
  encrypted_profile jsonb not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  time_zone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint user_profiles_user_id_unique unique (user_id),
  constraint user_profiles_household_id_id_unique unique (household_id, id),
  constraint user_profiles_membership_fk
    foreign key (household_id, membership_id)
    references littlearc.household_memberships (household_id, id) on delete restrict
);
create index user_profiles_household_idx on littlearc.user_profiles (household_id);

create table littlearc.membership_capabilities (
  household_id uuid not null references littlearc.households(id) on delete restrict,
  membership_id uuid not null,
  capability text not null check (
    capability in (
      'viewEmergencyCard', 'viewSelectedHealthRecords', 'viewIdentityDocuments',
      'addRecords', 'editConfirmedRecords', 'manageTasks'
    )
  ),
  granted_by uuid not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint membership_capabilities_pk
    primary key (membership_id, capability, granted_at),
  constraint membership_capabilities_membership_fk
    foreign key (household_id, membership_id)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  constraint membership_capabilities_granted_by_fk
    foreign key (household_id, granted_by)
    references littlearc.household_memberships (household_id, id) on delete restrict
);

create table littlearc.devices (
  id uuid primary key,
  user_id text not null references littlearc.auth_user(id) on delete restrict,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  platform text not null check (platform in ('android', 'ios')),
  app_version text not null,
  enrollment_status text not null check (enrollment_status in ('pending', 'active', 'revoked')),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index devices_user_status_idx on littlearc.devices (user_id, enrollment_status);
create index devices_household_status_idx on littlearc.devices (household_id, enrollment_status);

create table littlearc.consent_events (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  actor_membership_id uuid not null,
  child_id uuid,
  purpose text not null check (
    purpose in ('parent_notice', 'child_data_processing',
      'third_party_vision_processing', 'cloud_ai_extraction')
  ),
  state text not null check (state in ('granted', 'withdrawn')),
  notice_version text not null,
  request_id uuid not null,
  disclosure jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint consent_events_actor_fk
    foreign key (household_id, actor_membership_id)
    references littlearc.household_memberships (household_id, id) on delete restrict
);
create index consent_events_household_time_idx
  on littlearc.consent_events (household_id, occurred_at);
create index consent_events_actor_idx
  on littlearc.consent_events (actor_membership_id);

alter table littlearc.children
  add constraint children_household_id_id_unique unique (household_id, id),
  add constraint children_created_by_membership_fk
    foreign key (household_id, created_by)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  add constraint children_updated_by_membership_fk
    foreign key (household_id, updated_by)
    references littlearc.household_memberships (household_id, id) on delete restrict;

alter table littlearc.consent_events
  add constraint consent_events_child_fk
  foreign key (household_id, child_id)
  references littlearc.children (household_id, id) on delete restrict;

alter table littlearc.audit_events
  add column target_type text,
  add column target_id uuid,
  add column request_id uuid,
  add column result text,
  add column failure_code text;

update littlearc.audit_events
set
  target_type = 'legacy_event',
  target_id = id,
  request_id = id,
  result = 'success'
where target_type is null;

alter table littlearc.audit_events
  alter column target_type set not null,
  alter column target_id set not null,
  alter column request_id set not null,
  alter column result set not null,
  add constraint audit_events_result_check check (result in ('success', 'failure')),
  add constraint audit_events_actor_fk
    foreign key (household_id, actor_id)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  add constraint audit_events_failure_code_check check (
    (result = 'success' and failure_code is null) or result = 'failure'
  );

alter table littlearc.user_profiles
  add constraint user_profiles_envelope_check check (
    jsonb_typeof(encrypted_profile) = 'object'
    and encrypted_profile ->> 'formatVersion' = '1'
    and encrypted_profile ->> 'algorithm' = 'AES-256-GCM'
    and encrypted_profile ?& array[
      'keyVersion', 'wrappedDek', 'wrapNonce', 'contentNonce',
      'authTag', 'ciphertext', 'aadSchemaVersion'
    ]
  );

alter table littlearc.children
  add constraint children_envelope_check check (
    jsonb_typeof(encrypted_profile) = 'object'
    and encrypted_profile ->> 'formatVersion' = '1'
    and encrypted_profile ->> 'algorithm' = 'AES-256-GCM'
    and encrypted_profile ?& array[
      'keyVersion', 'wrappedDek', 'wrapNonce', 'contentNonce',
      'authTag', 'ciphertext', 'aadSchemaVersion'
    ]
  );

alter table littlearc.household_memberships enable row level security;
alter table littlearc.household_memberships force row level security;
alter table littlearc.household_keys enable row level security;
alter table littlearc.household_keys force row level security;
alter table littlearc.user_profiles enable row level security;
alter table littlearc.user_profiles force row level security;
alter table littlearc.membership_capabilities enable row level security;
alter table littlearc.membership_capabilities force row level security;
alter table littlearc.devices enable row level security;
alter table littlearc.devices force row level security;
alter table littlearc.consent_events enable row level security;
alter table littlearc.consent_events force row level security;

create policy household_memberships_tenant_isolation on littlearc.household_memberships
  using (
    household_id = littlearc.current_household_id()
    or user_id = littlearc.current_identity_user_id()
  )
  with check (
    household_id = littlearc.current_household_id()
    and user_id = littlearc.current_identity_user_id()
  );
create policy household_keys_tenant_isolation on littlearc.household_keys
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());
create policy user_profiles_tenant_isolation on littlearc.user_profiles
  using (household_id = littlearc.current_household_id())
  with check (
    household_id = littlearc.current_household_id()
    and user_id = littlearc.current_identity_user_id()
  );
create policy membership_capabilities_tenant_isolation on littlearc.membership_capabilities
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());
create policy devices_tenant_isolation on littlearc.devices
  using (
    household_id = littlearc.current_household_id()
    and user_id = littlearc.current_identity_user_id()
  )
  with check (
    household_id = littlearc.current_household_id()
    and user_id = littlearc.current_identity_user_id()
  );
create policy consent_events_tenant_isolation on littlearc.consent_events
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());

grant select, insert, update on
  littlearc.household_memberships,
  littlearc.user_profiles,
  littlearc.membership_capabilities,
  littlearc.devices,
  littlearc.household_keys
to littlearc_app;
grant select, insert on littlearc.consent_events to littlearc_app;
grant select on
  littlearc.household_memberships,
  littlearc.user_profiles,
  littlearc.membership_capabilities,
  littlearc.devices,
  littlearc.consent_events
to littlearc_ops_readonly;
revoke update, delete on littlearc.consent_events, littlearc.audit_events
from littlearc_app, littlearc_worker;
revoke all on littlearc.household_keys from littlearc_worker, littlearc_ops_readonly;

insert into littlearc.schema_migrations (version, checksum_sha256)
values ('0003_off_02_household_consent_audit', '__CHECKSUM_SHA256__')
on conflict (version) do nothing;

commit;
`.trim();

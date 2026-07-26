export const off05EmergencyCardMigration = {
  description: "OFF-05 encrypted emergency-card aggregate and immutable versions",
  filename: "0004_off_05_emergency_card.sql",
  version: "0004_off_05_emergency_card",
} as const;

export const off05EmergencyCardMigrationSql = `
begin;

create table littlearc.emergency_cards (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  child_id uuid not null,
  current_version_id uuid,
  access_mode text not null check (access_mode = 'standard'),
  status text not null check (status in ('active', 'archived')),
  created_by uuid not null,
  updated_by uuid not null,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint emergency_cards_household_id_id_unique unique (household_id, id),
  constraint emergency_cards_child_fk
    foreign key (household_id, child_id)
    references littlearc.children (household_id, id) on delete restrict,
  constraint emergency_cards_created_by_fk
    foreign key (household_id, created_by)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  constraint emergency_cards_updated_by_fk
    foreign key (household_id, updated_by)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  constraint emergency_cards_state_check check (
    (status = 'active' and deleted_at is null) or
    (status = 'archived' and deleted_at is not null)
  )
);
create index emergency_cards_household_idx
  on littlearc.emergency_cards (household_id);
create index emergency_cards_child_idx
  on littlearc.emergency_cards (household_id, child_id);
create unique index emergency_cards_one_active_child_idx
  on littlearc.emergency_cards (household_id, child_id)
  where status = 'active' and deleted_at is null;

create table littlearc.emergency_card_versions (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  emergency_card_id uuid not null,
  version_number integer not null check (version_number > 0),
  encrypted_payload jsonb not null,
  confirmed_by uuid not null,
  confirmed_at timestamptz not null default now(),
  source_revision integer not null check (source_revision > 0),
  created_at timestamptz not null default now(),
  constraint emergency_card_versions_card_version_unique
    unique (emergency_card_id, version_number),
  constraint emergency_card_versions_current_fk_unique
    unique (household_id, emergency_card_id, id),
  constraint emergency_card_versions_card_fk
    foreign key (household_id, emergency_card_id)
    references littlearc.emergency_cards (household_id, id) on delete restrict,
  constraint emergency_card_versions_confirmed_by_fk
    foreign key (household_id, confirmed_by)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  constraint emergency_card_versions_envelope_check check (
    jsonb_typeof(encrypted_payload) = 'object'
    and encrypted_payload ->> 'formatVersion' = '1'
    and encrypted_payload ->> 'algorithm' = 'AES-256-GCM'
    and encrypted_payload ?& array[
      'keyVersion', 'wrappedDek', 'wrapNonce', 'contentNonce',
      'authTag', 'ciphertext', 'aadSchemaVersion'
    ]
  )
);
create index emergency_card_versions_card_idx
  on littlearc.emergency_card_versions
    (household_id, emergency_card_id, version_number);

alter table littlearc.emergency_cards
  add constraint emergency_cards_current_version_fk
  foreign key (household_id, id, current_version_id)
  references littlearc.emergency_card_versions
    (household_id, emergency_card_id, id)
  deferrable initially deferred;

create function littlearc.reject_emergency_card_version_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'emergency card versions are immutable' using errcode = '42501';
end $$;

create trigger emergency_card_versions_immutable
before update or delete on littlearc.emergency_card_versions
for each row execute function littlearc.reject_emergency_card_version_mutation();

alter table littlearc.emergency_cards enable row level security;
alter table littlearc.emergency_cards force row level security;
alter table littlearc.emergency_card_versions enable row level security;
alter table littlearc.emergency_card_versions force row level security;

create policy emergency_cards_tenant_isolation on littlearc.emergency_cards
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());
create policy emergency_card_versions_tenant_isolation
  on littlearc.emergency_card_versions
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());

grant select, insert, update on littlearc.emergency_cards to littlearc_app;
grant select, insert on littlearc.emergency_card_versions to littlearc_app;
grant select on littlearc.emergency_cards to littlearc_ops_readonly;
revoke update, delete on littlearc.emergency_card_versions
from littlearc_app, littlearc_worker, littlearc_ops_readonly;
revoke all on littlearc.emergency_card_versions
from littlearc_worker, littlearc_ops_readonly;

insert into littlearc.schema_migrations (version, checksum_sha256)
values ('0004_off_05_emergency_card', '__CHECKSUM_SHA256__')
on conflict (version) do nothing;

commit;
`.trim();

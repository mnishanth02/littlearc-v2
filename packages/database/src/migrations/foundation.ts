export const foundationMigration = {
  description:
    "Database foundation, roles, tenant context, RLS, audit, idempotency, change feed, and outbox",
  filename: "0001_fnd_05_database_foundation.sql",
  version: "0001_fnd_05_database_foundation",
} as const;

export const foundationMigrationSql = `
begin;

create schema if not exists littlearc;

do $$
begin
  create role littlearc_migration noinherit;
exception when duplicate_object then null;
end
$$;

do $$
begin
  create role littlearc_app noinherit;
exception when duplicate_object then null;
end
$$;

do $$
begin
  create role littlearc_worker noinherit;
exception when duplicate_object then null;
end
$$;

do $$
begin
  create role littlearc_ops_readonly noinherit;
exception when duplicate_object then null;
end
$$;

create or replace function littlearc.current_household_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('littlearc.current_household_id', true), '')::uuid;
$$;

create or replace function littlearc.current_actor_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('littlearc.current_actor_id', true), '')::uuid;
$$;

create or replace function littlearc.current_actor_role()
returns text
language sql
stable
as $$
  select nullif(current_setting('littlearc.current_actor_role', true), '');
$$;

create table if not exists littlearc.households (
  id uuid primary key,
  status text not null default 'active',
  default_country_code text not null default 'US',
  access_policy text not null default 'owner-managed',
  created_by uuid not null,
  updated_by uuid not null,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists littlearc.schema_migrations (
  version text primary key,
  checksum_sha256 text not null,
  applied_at timestamptz not null default now()
);

create table if not exists littlearc.children (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  encrypted_profile jsonb not null,
  access_policy jsonb not null,
  created_by uuid not null,
  updated_by uuid not null,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists children_household_idx
  on littlearc.children (household_id);

create index if not exists children_household_updated_idx
  on littlearc.children (household_id, updated_at);

create table if not exists littlearc.audit_events (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  actor_id uuid not null,
  actor_role text not null,
  action text not null,
  purpose_code text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_events_household_time_idx
  on littlearc.audit_events (household_id, occurred_at);

create index if not exists audit_events_actor_idx
  on littlearc.audit_events (actor_id);

create table if not exists littlearc.idempotency_results (
  household_id uuid not null references littlearc.households(id) on delete cascade,
  actor_id uuid not null,
  idempotency_key uuid not null,
  mutation_id uuid not null,
  request_fingerprint text not null,
  response_status integer not null check (response_status between 200 and 599),
  response_body jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint idempotency_results_pk primary key (household_id, actor_id, idempotency_key)
);

create index if not exists idempotency_results_expires_at_idx
  on littlearc.idempotency_results (expires_at);

create index if not exists idempotency_results_mutation_idx
  on littlearc.idempotency_results (household_id, mutation_id);

create table if not exists littlearc.change_events (
  sequence bigserial primary key,
  household_id uuid not null references littlearc.households(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  operation text not null check (operation in ('upsert', 'delete')),
  revision integer not null check (revision > 0),
  actor_id uuid,
  mutation_id uuid,
  payload jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists change_events_household_sequence_idx
  on littlearc.change_events (household_id, sequence);

create index if not exists change_events_entity_idx
  on littlearc.change_events (household_id, entity_type, entity_id);

create table if not exists littlearc.outbox_events (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete cascade,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null,
  available_at timestamptz not null default now(),
  dispatched_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists outbox_events_pending_idx
  on littlearc.outbox_events (dispatched_at, available_at);

create index if not exists outbox_events_household_created_idx
  on littlearc.outbox_events (household_id, created_at);

alter table littlearc.households enable row level security;
alter table littlearc.households force row level security;
alter table littlearc.children enable row level security;
alter table littlearc.children force row level security;
alter table littlearc.audit_events enable row level security;
alter table littlearc.audit_events force row level security;
alter table littlearc.idempotency_results enable row level security;
alter table littlearc.idempotency_results force row level security;
alter table littlearc.change_events enable row level security;
alter table littlearc.change_events force row level security;
alter table littlearc.outbox_events enable row level security;
alter table littlearc.outbox_events force row level security;

drop policy if exists households_tenant_isolation on littlearc.households;
create policy households_tenant_isolation on littlearc.households
  using (id = littlearc.current_household_id())
  with check (id = littlearc.current_household_id());

drop policy if exists children_tenant_isolation on littlearc.children;
create policy children_tenant_isolation on littlearc.children
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());

drop policy if exists audit_events_tenant_isolation on littlearc.audit_events;
create policy audit_events_tenant_isolation on littlearc.audit_events
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());

drop policy if exists idempotency_results_tenant_isolation on littlearc.idempotency_results;
create policy idempotency_results_tenant_isolation on littlearc.idempotency_results
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());

drop policy if exists change_events_tenant_isolation on littlearc.change_events;
create policy change_events_tenant_isolation on littlearc.change_events
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());

drop policy if exists outbox_events_tenant_isolation on littlearc.outbox_events;
create policy outbox_events_tenant_isolation on littlearc.outbox_events
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());

grant usage on schema littlearc to littlearc_app, littlearc_worker, littlearc_ops_readonly;
grant select, insert, update on all tables in schema littlearc to littlearc_app;
grant select, insert, update on littlearc.outbox_events to littlearc_worker;
grant select on all tables in schema littlearc to littlearc_ops_readonly;
grant usage, select on all sequences in schema littlearc to littlearc_app, littlearc_worker;

insert into littlearc.schema_migrations (version, checksum_sha256)
values ('0001_fnd_05_database_foundation', '__CHECKSUM_SHA256__')
on conflict (version) do nothing;

commit;
`.trim();

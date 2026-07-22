export const off01AuthMigration = {
  description: "Better Auth consumer identity, session, verification, and rate-limit storage",
  filename: "0002_off_01_consumer_auth.sql",
  version: "0002_off_01_consumer_auth",
} as const;

export const off01AuthMigrationSql = `
begin;

create table if not exists littlearc.auth_user (
  id text primary key,
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists littlearc.auth_session (
  id text primary key,
  expires_at timestamp not null,
  token text not null unique,
  created_at timestamp not null default now(),
  updated_at timestamp not null,
  ip_address text,
  user_agent text,
  user_id text not null references littlearc.auth_user(id) on delete cascade
);

create index if not exists auth_session_userId_idx
  on littlearc.auth_session (user_id);

create table if not exists littlearc.auth_account (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references littlearc.auth_user(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamp,
  refresh_token_expires_at timestamp,
  scope text,
  password text,
  created_at timestamp not null default now(),
  updated_at timestamp not null
);

create index if not exists auth_account_userId_idx
  on littlearc.auth_account (user_id);

create table if not exists littlearc.auth_verification (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamp not null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists auth_verification_identifier_idx
  on littlearc.auth_verification (identifier);

create table if not exists littlearc.auth_rate_limit (
  id text primary key,
  key text not null unique,
  count integer not null,
  last_request bigint not null
);

grant select, insert, update, delete on
  littlearc.auth_user,
  littlearc.auth_session,
  littlearc.auth_account,
  littlearc.auth_verification,
  littlearc.auth_rate_limit
to littlearc_app;

revoke all on
  littlearc.auth_user,
  littlearc.auth_session,
  littlearc.auth_account,
  littlearc.auth_verification,
  littlearc.auth_rate_limit
from littlearc_worker, littlearc_ops_readonly;

insert into littlearc.schema_migrations (version, checksum_sha256)
values ('0002_off_01_consumer_auth', '__CHECKSUM_SHA256__')
on conflict (version) do nothing;

commit;
`.trim();

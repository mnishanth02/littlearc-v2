export const vlt01RecordFoundationMigration = {
  description: "VLT-01 encrypted record versions, suggestions, and Timeline projections",
  filename: "0005_vlt_01_record_foundation.sql",
  version: "0005_vlt_01_record_foundation",
} as const;

export const vlt01RecordFoundationMigrationSql = `
begin;

alter table littlearc.consent_events
  add constraint consent_events_household_id_id_unique
  unique (household_id, id);

create table littlearc.records (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  child_id uuid not null,
  category text not null check (
    category in ('emergency','identity','vaccination','doctor_visit',
                 'prescription','document','memory')
  ),
  source_type text not null check (
    source_type in ('manual','imported','ocr_assisted','ai_assisted',
                    'provider_issued','government_imported')
  ),
  confirmation_state text not null check (
    confirmation_state in ('draft','suggested','confirmed','archived')
  ),
  event_at timestamptz,
  current_version_id uuid,
  access_scope text not null check (
    access_scope in ('selectedHealthRecords','identityDocuments')
  ),
  ai_assisted boolean not null default false,
  created_by uuid not null,
  updated_by uuid not null,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint records_household_id_id_unique unique (household_id, id),
  constraint records_child_fk
    foreign key (household_id, child_id)
    references littlearc.children (household_id, id) on delete restrict,
  constraint records_created_by_fk
    foreign key (household_id, created_by)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  constraint records_updated_by_fk
    foreign key (household_id, updated_by)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  constraint records_access_category_check check (
    (category = 'identity' and access_scope = 'identityDocuments') or
    (category <> 'identity' and access_scope = 'selectedHealthRecords')
  ),
  constraint records_ai_assisted_check check (
    ai_assisted = (source_type = 'ai_assisted')
  )
);
create index records_household_idx
  on littlearc.records (household_id);
create index records_child_event_idx
  on littlearc.records (household_id, child_id, event_at desc nulls last, id desc)
  where deleted_at is null;

create table littlearc.record_versions (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  record_id uuid not null,
  version_number integer not null check (version_number > 0),
  payload_schema_version integer not null check (payload_schema_version = 1),
  encrypted_payload jsonb not null,
  confirmation_state text not null check (
    confirmation_state in ('draft','suggested','confirmed','archived')
  ),
  provenance_type text not null check (
    provenance_type in ('manual','imported','ocr_assisted','ai_assisted',
                        'provider_issued','government_imported')
  ),
  source_issuer_id uuid,
  confirmed_by uuid,
  confirmed_at timestamptz,
  supersedes_version_id uuid,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint record_versions_record_version_unique
    unique (household_id, record_id, version_number),
  constraint record_versions_current_fk_unique
    unique (household_id, record_id, id),
  constraint record_versions_record_fk
    foreign key (household_id, record_id)
    references littlearc.records (household_id, id) on delete restrict,
  constraint record_versions_confirmed_by_fk
    foreign key (household_id, confirmed_by)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  constraint record_versions_created_by_fk
    foreign key (household_id, created_by)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  constraint record_versions_confirmation_pair_check check (
    (
      confirmation_state in ('confirmed','archived')
      and confirmed_by is not null
      and confirmed_at is not null
    ) or (
      confirmation_state in ('draft','suggested')
      and confirmed_by is null
      and confirmed_at is null
    )
  ),
  constraint record_versions_trusted_issuer_check check (
    (
      provenance_type in ('provider_issued','government_imported')
      and source_issuer_id is not null
    ) or (
      provenance_type not in ('provider_issued','government_imported')
      and source_issuer_id is null
    )
  ),
  constraint record_versions_envelope_check check (
    jsonb_typeof(encrypted_payload) = 'object'
    and encrypted_payload ->> 'formatVersion' = '1'
    and encrypted_payload ->> 'algorithm' = 'AES-256-GCM'
    and encrypted_payload ?& array[
      'keyVersion', 'wrappedDek', 'wrapNonce', 'contentNonce',
      'authTag', 'ciphertext', 'aadSchemaVersion'
    ]
  )
);
create index record_versions_record_created_idx
  on littlearc.record_versions (household_id, record_id, created_at desc);

alter table littlearc.record_versions
  add constraint record_versions_supersedes_fk
  foreign key (household_id, record_id, supersedes_version_id)
  references littlearc.record_versions (household_id, record_id, id)
  on delete restrict;

alter table littlearc.records
  add constraint records_current_version_fk
  foreign key (household_id, id, current_version_id)
  references littlearc.record_versions (household_id, record_id, id)
  deferrable initially deferred;

create table littlearc.record_suggestions (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  record_id uuid not null,
  record_version_id uuid,
  field_path text not null check (
    char_length(field_path) between 1 and 240
    and field_path !~ '[[:space:]]'
  ),
  encrypted_suggestion jsonb not null,
  encrypted_source_span jsonb not null,
  confidence_bucket text not null check (
    confidence_bucket in ('low','medium','high')
  ),
  extractor_type text not null check (
    extractor_type in ('local_ocr','cloud_ocr','cloud_ai')
  ),
  model_id text,
  prompt_version text,
  consent_event_id uuid,
  review_state text not null check (
    review_state in ('pending','accepted','rejected','expired')
  ),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint record_suggestions_record_fk
    foreign key (household_id, record_id)
    references littlearc.records (household_id, id) on delete restrict,
  constraint record_suggestions_version_fk
    foreign key (household_id, record_id, record_version_id)
    references littlearc.record_versions (household_id, record_id, id)
    on delete restrict,
  constraint record_suggestions_consent_fk
    foreign key (household_id, consent_event_id)
    references littlearc.consent_events (household_id, id) on delete restrict,
  constraint record_suggestions_reviewed_by_fk
    foreign key (household_id, reviewed_by)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  constraint record_suggestions_review_pair_check check (
    (
      review_state = 'pending'
      and reviewed_by is null
      and reviewed_at is null
    ) or (
      review_state in ('accepted','rejected')
      and reviewed_by is not null
      and reviewed_at is not null
    ) or (
      review_state = 'expired'
      and reviewed_by is null
    )
  ),
  constraint record_suggestions_cloud_consent_check check (
    (
      extractor_type in ('cloud_ocr','cloud_ai')
      and consent_event_id is not null
    ) or extractor_type = 'local_ocr'
  ),
  constraint record_suggestions_suggestion_envelope_check check (
    jsonb_typeof(encrypted_suggestion) = 'object'
    and encrypted_suggestion ->> 'formatVersion' = '1'
    and encrypted_suggestion ->> 'algorithm' = 'AES-256-GCM'
    and encrypted_suggestion ?& array[
      'keyVersion', 'wrappedDek', 'wrapNonce', 'contentNonce',
      'authTag', 'ciphertext', 'aadSchemaVersion'
    ]
  ),
  constraint record_suggestions_source_span_envelope_check check (
    jsonb_typeof(encrypted_source_span) = 'object'
    and encrypted_source_span ->> 'formatVersion' = '1'
    and encrypted_source_span ->> 'algorithm' = 'AES-256-GCM'
    and encrypted_source_span ?& array[
      'keyVersion', 'wrappedDek', 'wrapNonce', 'contentNonce',
      'authTag', 'ciphertext', 'aadSchemaVersion'
    ]
  )
);
create index record_suggestions_pending_idx
  on littlearc.record_suggestions (household_id, record_id, created_at)
  where review_state = 'pending';

create table littlearc.timeline_entries (
  id uuid primary key,
  household_id uuid not null references littlearc.households(id) on delete restrict,
  child_id uuid not null,
  entry_type text not null check (entry_type = 'record'),
  event_at timestamptz not null,
  source_record_id uuid not null,
  source_version_id uuid not null,
  encrypted_payload jsonb not null,
  visibility text not null check (visibility = 'household'),
  projection_state text not null check (
    projection_state in ('active','inactive','tombstoned')
  ),
  created_by uuid not null,
  updated_by uuid not null,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint timeline_entries_household_id_id_unique
    unique (household_id, id),
  constraint timeline_entries_source_version_unique
    unique (household_id, source_version_id),
  constraint timeline_entries_child_fk
    foreign key (household_id, child_id)
    references littlearc.children (household_id, id) on delete restrict,
  constraint timeline_entries_record_fk
    foreign key (household_id, source_record_id)
    references littlearc.records (household_id, id) on delete restrict,
  constraint timeline_entries_version_fk
    foreign key (household_id, source_record_id, source_version_id)
    references littlearc.record_versions (household_id, record_id, id)
    on delete restrict,
  constraint timeline_entries_created_by_fk
    foreign key (household_id, created_by)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  constraint timeline_entries_updated_by_fk
    foreign key (household_id, updated_by)
    references littlearc.household_memberships (household_id, id) on delete restrict,
  constraint timeline_entries_deleted_state_check check (
    (
      projection_state = 'tombstoned'
      and deleted_at is not null
    ) or (
      projection_state in ('active','inactive')
      and deleted_at is null
    )
  ),
  constraint timeline_entries_envelope_check check (
    jsonb_typeof(encrypted_payload) = 'object'
    and encrypted_payload ->> 'formatVersion' = '1'
    and encrypted_payload ->> 'algorithm' = 'AES-256-GCM'
    and encrypted_payload ?& array[
      'keyVersion', 'wrappedDek', 'wrapNonce', 'contentNonce',
      'authTag', 'ciphertext', 'aadSchemaVersion'
    ]
  )
);
create index timeline_entries_child_event_idx
  on littlearc.timeline_entries
    (household_id, child_id, event_at desc, id desc)
  where projection_state = 'active' and deleted_at is null;
create unique index timeline_entries_one_active_record_idx
  on littlearc.timeline_entries (household_id, source_record_id)
  where projection_state = 'active' and deleted_at is null;

create function littlearc.reject_record_version_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'record versions are immutable' using errcode = '42501';
end $$;

create trigger record_versions_immutable
before update or delete on littlearc.record_versions
for each row execute function littlearc.reject_record_version_mutation();

alter table littlearc.records enable row level security;
alter table littlearc.records force row level security;
alter table littlearc.record_versions enable row level security;
alter table littlearc.record_versions force row level security;
alter table littlearc.record_suggestions enable row level security;
alter table littlearc.record_suggestions force row level security;
alter table littlearc.timeline_entries enable row level security;
alter table littlearc.timeline_entries force row level security;

create policy records_tenant_isolation on littlearc.records
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());
create policy record_versions_tenant_isolation on littlearc.record_versions
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());
create policy record_suggestions_tenant_isolation on littlearc.record_suggestions
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());
create policy timeline_entries_tenant_isolation on littlearc.timeline_entries
  using (household_id = littlearc.current_household_id())
  with check (household_id = littlearc.current_household_id());

grant select, insert, update on littlearc.records to littlearc_app;
grant select, insert on littlearc.record_versions to littlearc_app;
grant select, insert, update on littlearc.record_suggestions to littlearc_app;
grant select, insert, update on littlearc.timeline_entries to littlearc_app;

revoke update, delete on littlearc.record_versions
from littlearc_app, littlearc_worker, littlearc_ops_readonly;
revoke all on littlearc.records, littlearc.record_versions,
  littlearc.record_suggestions, littlearc.timeline_entries
from littlearc_worker, littlearc_ops_readonly;

insert into littlearc.schema_migrations (version, checksum_sha256)
values ('0005_vlt_01_record_foundation', '__CHECKSUM_SHA256__')
on conflict (version) do nothing;

commit;
`.trim();

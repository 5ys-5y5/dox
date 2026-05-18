-- DOC-CLOUD-01
-- /project > 선택한 문서 상세가 기대하는 documents 스키마를 생성합니다.
-- 실행 위치: Supabase SQL Editor
--
-- 배경:
-- - 현재 앱 코드는 documents.document_registry / document_versions /
--   document_artifacts / document_value_files 를 직접 조회합니다.
-- - 특히 첨부파일 슬롯은 documents.document_value_files 가 없으면
--   "Could not find the table 'documents.document_value_files' in the schema cache"
--   오류가 발생합니다.
--
-- 중요:
-- 1. 이 파일은 재실행 가능하도록 if not exists / 조건부 constraint 로 작성했습니다.
-- 2. template_id 는 templates.template_registry(id) 와 연결되도록 설계했습니다.
-- 3. 실행 후에도 Data API/PostgREST 가 기존 스키마 캐시를 들고 있으면
--    아래를 별도로 실행해야 할 수 있습니다.
--
-- ALTER ROLE authenticator SET pgrst.db_schemas = 'public, signing, documents, sites, templates';
-- NOTIFY pgrst, 'reload config';
-- NOTIFY pgrst, 'reload schema';

create extension if not exists pgcrypto;

create schema if not exists documents;

grant usage on schema documents to service_role;
grant all on all tables in schema documents to service_role;
grant all on all sequences in schema documents to service_role;
grant all on all routines in schema documents to service_role;
alter default privileges for role postgres in schema documents grant all on tables to service_role;
alter default privileges for role postgres in schema documents grant all on sequences to service_role;
alter default privileges for role postgres in schema documents grant all on routines to service_role;

create table if not exists documents.document_registry (
  id uuid not null default gen_random_uuid(),
  site_id text not null,
  document_type_key text not null,
  title text not null,
  template_id uuid null,
  status text not null default 'draft',
  current_version_id uuid null,
  current_version_number integer null,
  deleted_at timestamp with time zone null,
  deleted_by text null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint document_registry_pkey primary key (id),
  constraint document_registry_status_check check (
    status = any (array['draft'::text, 'active'::text, 'archived'::text, 'deleted'::text])
  ),
  constraint document_registry_current_version_number_check check (
    current_version_number is null or current_version_number >= 1
  )
);

create table if not exists documents.document_versions (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null,
  version_number integer not null,
  html_canonical text not null,
  html_sha256 text not null,
  html_hash_algorithm text not null default 'sha256'::text,
  html_hash_encoding text not null default 'hex'::text,
  html_canonicalization text not null default 'utf8-string'::text,
  html_byte_length integer not null,
  label_values jsonb not null default '{}'::jsonb,
  change_reason text null,
  created_by text null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint document_versions_pkey primary key (id),
  constraint document_versions_document_id_fkey foreign key (document_id)
    references documents.document_registry(id) on delete cascade,
  constraint document_versions_version_number_check check (version_number >= 1),
  constraint document_versions_html_sha256_check check (html_sha256 ~ '^[a-f0-9]{64}$'::text),
  constraint document_versions_html_canonicalization_check check (
    html_canonicalization = any (array['raw-bytes'::text, 'utf8-string'::text, 'canonical-json'::text])
  ),
  constraint document_versions_html_byte_length_check check (html_byte_length >= 0),
  constraint document_versions_label_values_check check (jsonb_typeof(label_values) = 'object'::text),
  constraint document_versions_document_id_version_number_key unique (document_id, version_number)
);

create table if not exists documents.document_artifacts (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null,
  version_id uuid not null,
  artifact_format text not null,
  storage_path text not null,
  mime_type text null,
  file_size_bytes bigint null,
  status text not null default 'ready'::text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint document_artifacts_pkey primary key (id),
  constraint document_artifacts_document_id_fkey foreign key (document_id)
    references documents.document_registry(id) on delete cascade,
  constraint document_artifacts_version_id_fkey foreign key (version_id)
    references documents.document_versions(id) on delete cascade,
  constraint document_artifacts_artifact_format_check check (
    artifact_format = any (array['pdf'::text, 'docx'::text, 'hwp'::text, 'preview'::text])
  ),
  constraint document_artifacts_file_size_bytes_check check (
    file_size_bytes is null or file_size_bytes >= 0
  ),
  constraint document_artifacts_status_check check (
    status = any (array['queued'::text, 'processing'::text, 'ready'::text, 'failed'::text])
  ),
  constraint document_artifacts_metadata_check check (jsonb_typeof(metadata) = 'object'::text)
);

create table if not exists documents.document_value_files (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null,
  version_id uuid not null,
  value_key text not null,
  storage_bucket text not null,
  storage_path text not null,
  original_file_name text not null,
  mime_type text null,
  file_size_bytes bigint null,
  sort_order integer not null default 0,
  uploaded_by text null,
  uploaded_at timestamp with time zone not null default timezone('utc'::text, now()),
  metadata jsonb not null default '{}'::jsonb,
  constraint document_value_files_pkey primary key (id),
  constraint document_value_files_document_id_fkey foreign key (document_id)
    references documents.document_registry(id) on delete cascade,
  constraint document_value_files_version_id_fkey foreign key (version_id)
    references documents.document_versions(id) on delete cascade,
  constraint document_value_files_value_key_check check (btrim(value_key) <> ''::text),
  constraint document_value_files_storage_bucket_check check (btrim(storage_bucket) <> ''::text),
  constraint document_value_files_storage_path_check check (btrim(storage_path) <> ''::text),
  constraint document_value_files_original_file_name_check check (btrim(original_file_name) <> ''::text),
  constraint document_value_files_file_size_bytes_check check (
    file_size_bytes is null or file_size_bytes >= 0
  ),
  constraint document_value_files_sort_order_check check (sort_order >= 0),
  constraint document_value_files_metadata_check check (jsonb_typeof(metadata) = 'object'::text)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_document_registry_current_version'
      and conrelid = 'documents.document_registry'::regclass
  ) then
    alter table documents.document_registry
      add constraint fk_document_registry_current_version
      foreign key (current_version_id)
      references documents.document_versions(id)
      on delete set null;
  end if;
end;
$$;

do $$
begin
  if to_regclass('templates.template_registry') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'fk_document_registry_template'
         and conrelid = 'documents.document_registry'::regclass
     ) then
    alter table documents.document_registry
      add constraint fk_document_registry_template
      foreign key (template_id)
      references templates.template_registry(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists idx_document_registry_site_status
  on documents.document_registry using btree (site_id, status, updated_at desc);

create index if not exists idx_document_registry_document_type
  on documents.document_registry using btree (document_type_key, updated_at desc);

create index if not exists idx_document_registry_template_id
  on documents.document_registry using btree (template_id);

create index if not exists idx_document_versions_document_id
  on documents.document_versions using btree (document_id, version_number desc);

create index if not exists idx_document_artifacts_document_id
  on documents.document_artifacts using btree (document_id, created_at desc);

create index if not exists idx_document_value_files_document_version
  on documents.document_value_files using btree (document_id, version_id, value_key, sort_order, uploaded_at);

create or replace function documents.set_document_registry_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_document_registry_updated_at on documents.document_registry;

create trigger set_document_registry_updated_at
before update on documents.document_registry
for each row
execute function documents.set_document_registry_updated_at();

comment on schema documents is 'DOC-CLOUD-01 documents domain schema';
comment on table documents.document_registry is 'Template-derived site document metadata registry';
comment on table documents.document_versions is 'Canonical HTML and label value snapshot per document version';
comment on table documents.document_artifacts is 'Derived output artifact metadata for document versions';
comment on table documents.document_value_files is 'Document attachment slot snapshot store for selected document detail';

-- 적용 확인용
select
  to_regclass('documents.document_registry') as document_registry_table,
  to_regclass('documents.document_versions') as document_versions_table,
  to_regclass('documents.document_artifacts') as document_artifacts_table,
  to_regclass('documents.document_value_files') as document_value_files_table,
  to_regclass('templates.template_registry') as template_registry_table;

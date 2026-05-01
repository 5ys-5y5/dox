-- DOC-CLOUD-01
-- 서류 클라우드 관리용 documents 스키마와 기본 저장 구조를 생성합니다.
-- 실행 위치: Supabase SQL Editor
--
-- 중요:
-- 1. 이 파일은 실행 전 SQL 이므로 docs/ 에 보관합니다.
-- 2. 실행 완료 후 아카이브가 필요하면 docs/applied/ 로 이동합니다.
-- 3. 앱 코드가 schema('documents') 를 사용하므로, 실행 후 runtime 에서
--    "schema must be one of the following" 류 오류가 나오면 아래도 함께 적용해야 합니다.
--
-- ALTER ROLE authenticator SET pgrst.db_schemas = 'public, signing, documents';
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
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  document_type_key text not null,
  title text not null,
  template_id uuid null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived', 'deleted')),
  current_version_id uuid null,
  current_version_number integer null check (current_version_number is null or current_version_number >= 1),
  deleted_at timestamptz null,
  deleted_by text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists documents.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents.document_registry(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  html_canonical text not null,
  html_sha256 text not null check (html_sha256 ~ '^[a-f0-9]{64}$'),
  html_hash_algorithm text not null default 'sha256',
  html_hash_encoding text not null default 'hex',
  html_canonicalization text not null default 'utf8-string'
    check (html_canonicalization in ('raw-bytes', 'utf8-string', 'canonical-json')),
  html_byte_length integer not null check (html_byte_length >= 0),
  label_values jsonb not null default '{}'::jsonb
    check (jsonb_typeof(label_values) = 'object'),
  change_reason text null,
  created_by text null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (document_id, version_number)
);

create table if not exists documents.document_artifacts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents.document_registry(id) on delete cascade,
  version_id uuid not null references documents.document_versions(id) on delete cascade,
  artifact_format text not null
    check (artifact_format in ('pdf', 'docx', 'hwp', 'preview')),
  storage_path text not null,
  mime_type text null,
  file_size_bytes bigint null check (file_size_bytes is null or file_size_bytes >= 0),
  status text not null default 'ready'
    check (status in ('queued', 'processing', 'ready', 'failed')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists documents.document_value_files (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents.document_registry(id) on delete cascade,
  version_id uuid not null references documents.document_versions(id) on delete cascade,
  value_key text not null check (btrim(value_key) <> ''),
  storage_bucket text not null check (btrim(storage_bucket) <> ''),
  storage_path text not null check (btrim(storage_path) <> ''),
  original_file_name text not null check (btrim(original_file_name) <> ''),
  mime_type text null,
  file_size_bytes bigint null check (file_size_bytes is null or file_size_bytes >= 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  uploaded_by text null,
  uploaded_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object')
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

create index if not exists idx_document_registry_site_status
  on documents.document_registry(site_id, status, updated_at desc);

create index if not exists idx_document_registry_document_type
  on documents.document_registry(document_type_key, updated_at desc);

create index if not exists idx_document_versions_document_id
  on documents.document_versions(document_id, version_number desc);

create index if not exists idx_document_artifacts_document_id
  on documents.document_artifacts(document_id, created_at desc);

create index if not exists idx_document_value_files_document_version
  on documents.document_value_files(document_id, version_id, value_key, sort_order, uploaded_at);

create or replace function documents.set_document_registry_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_document_registry_updated_at on documents.document_registry;

create trigger set_document_registry_updated_at
before update on documents.document_registry
for each row
execute function documents.set_document_registry_updated_at();

comment on schema documents is 'DOC-CLOUD-01 documents domain schema';
comment on table documents.document_registry is 'DOC-CLOUD-01 document metadata registry';
comment on table documents.document_versions is 'DOC-CLOUD-01 and DOC-CLOUD-02 canonical html version store';
comment on table documents.document_artifacts is 'DOC-CLOUD-02 derived output artifact metadata';
comment on table documents.document_value_files is 'DIVTYPE-01 document-scoped attachment slot snapshot store';

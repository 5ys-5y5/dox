-- EXPORT-01
-- 변환 저장 export job 메타데이터 구조를 생성합니다.
-- 실행 위치: Supabase SQL Editor
--
-- 중요:
-- 1. 이 파일은 실행 전 SQL 이므로 docs/ 에 보관합니다.
-- 2. 실행 완료 후 아카이브가 필요하면 docs/applied/ 로 이동합니다.
-- 3. 기존 documents 스키마가 먼저 준비되어 있어야 documents.document_artifacts 와 연결할 수 있습니다.

create schema if not exists exports;

grant usage on schema exports to service_role;
grant all on all tables in schema exports to service_role;
grant all on all sequences in schema exports to service_role;
grant all on all routines in schema exports to service_role;
alter default privileges for role postgres in schema exports grant all on tables to service_role;
alter default privileges for role postgres in schema exports grant all on sequences to service_role;
alter default privileges for role postgres in schema exports grant all on routines to service_role;

create or replace function exports.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create table if not exists exports.export_job_registry (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  version_id uuid not null,
  target_format text not null
    check (target_format in ('pdf', 'docx', 'hwp')),
  status text not null
    check (status in ('queued', 'completed', 'failed', 'external_required')),
  artifact_id uuid null,
  storage_path text null,
  mime_type text null,
  renderer_key text null,
  error_message text null,
  render_metadata jsonb not null default '{}'::jsonb,
  requested_by text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_export_job_registry_document_created_at
  on exports.export_job_registry(document_id, created_at desc);

create index if not exists idx_export_job_registry_status_created_at
  on exports.export_job_registry(status, created_at desc);

drop trigger if exists set_export_job_registry_updated_at on exports.export_job_registry;
create trigger set_export_job_registry_updated_at
before update on exports.export_job_registry
for each row
execute function exports.set_updated_at();

comment on schema exports is 'EXPORT export job domain schema';
comment on table exports.export_job_registry is 'EXPORT-01 export jobs linked to document version and artifacts';

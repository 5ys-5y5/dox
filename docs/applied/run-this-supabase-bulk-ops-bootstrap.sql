-- BULK-EDIT-01
-- 일괄 정보 입력 preview / commit 저장 구조를 생성합니다.
-- 실행 위치: Supabase SQL Editor
--
-- 중요:
-- 1. 이 파일은 실행 전 SQL 이므로 docs/ 에 보관합니다.
-- 2. 실행 완료 후 아카이브가 필요하면 docs/applied/ 로 이동합니다.
-- 3. 앱 코드가 schema('bulk_ops') 를 사용하므로 실행 후 runtime 에서
--    "Invalid schema: bulk_ops" 류 오류가 나오면 pgrst.db_schemas 에 bulk_ops 를 추가해야 합니다.

create schema if not exists bulk_ops;

grant usage on schema bulk_ops to service_role;
grant all on all tables in schema bulk_ops to service_role;
grant all on all sequences in schema bulk_ops to service_role;
grant all on all routines in schema bulk_ops to service_role;
alter default privileges for role postgres in schema bulk_ops grant all on tables to service_role;
alter default privileges for role postgres in schema bulk_ops grant all on sequences to service_role;
alter default privileges for role postgres in schema bulk_ops grant all on routines to service_role;

create table if not exists bulk_ops.bulk_operation_previews (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'draft'
    check (status in ('draft', 'committed', 'expired')),
  requested_by text null,
  document_count integer not null default 0
    check (document_count >= 0),
  change_count integer not null default 0
    check (change_count >= 0),
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  committed_at timestamptz null
);

create table if not exists bulk_ops.bulk_operation_preview_items (
  id uuid primary key default gen_random_uuid(),
  preview_id uuid not null references bulk_ops.bulk_operation_previews(id) on delete cascade,
  document_id uuid not null,
  document_version_id uuid null,
  document_title text not null,
  label_key text not null,
  change_action text not null
    check (change_action in ('upsert', 'delete')),
  before_value jsonb null,
  after_value jsonb null,
  item_status text not null
    check (item_status in ('apply', 'skip', 'blocked')),
  warning_text text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists bulk_ops.bulk_operation_commits (
  id uuid primary key default gen_random_uuid(),
  preview_id uuid not null references bulk_ops.bulk_operation_previews(id) on delete cascade,
  confirmed_by text not null,
  updated_document_count integer not null default 0
    check (updated_document_count >= 0),
  skipped_document_count integer not null default 0
    check (skipped_document_count >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_bulk_operation_previews_created_at
  on bulk_ops.bulk_operation_previews(created_at desc);

create index if not exists idx_bulk_operation_preview_items_preview
  on bulk_ops.bulk_operation_preview_items(preview_id, document_id);

create index if not exists idx_bulk_operation_commits_preview
  on bulk_ops.bulk_operation_commits(preview_id, created_at desc);

comment on schema bulk_ops is 'BULK-EDIT-01 bulk edit preview and commit domain schema';
comment on table bulk_ops.bulk_operation_previews is 'BULK-EDIT-02 preview metadata before commit';
comment on table bulk_ops.bulk_operation_preview_items is 'BULK-EDIT-02 field-level preview items and warnings';
comment on table bulk_ops.bulk_operation_commits is 'BULK-EDIT-03 actual commit history';

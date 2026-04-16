-- REQ-LINK-01
-- 제한 입력 요청 링크 저장 구조를 생성합니다.
-- 실행 위치: Supabase SQL Editor
--
-- 중요:
-- 1. 이 파일은 실행 전 SQL 이므로 docs/ 에 보관합니다.
-- 2. 실행 완료 후 아카이브가 필요하면 docs/applied/ 로 이동합니다.
-- 3. 앱 코드가 schema('request_links') 를 사용하므로 runtime 에서
--    "Invalid schema: request_links" 류 오류가 나오면 pgrst.db_schemas 에 request_links 를 추가해야 합니다.

create schema if not exists request_links;

grant usage on schema request_links to service_role;
grant all on all tables in schema request_links to service_role;
grant all on all sequences in schema request_links to service_role;
grant all on all routines in schema request_links to service_role;
alter default privileges for role postgres in schema request_links grant all on tables to service_role;
alter default privileges for role postgres in schema request_links grant all on sequences to service_role;
alter default privileges for role postgres in schema request_links grant all on routines to service_role;

create or replace function request_links.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create table if not exists request_links.request_link_registry (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  token_hash text not null unique,
  recipient_channel text not null
    check (recipient_channel in ('email', 'sms')),
  recipient_target text not null,
  recipient_name text null,
  allowed_labels text[] not null default '{}',
  expires_at timestamptz not null,
  one_time_use boolean not null default true,
  status text not null default 'active'
    check (status in ('active', 'submitted', 'expired', 'revoked')),
  requested_by text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists request_links.request_link_submit_audits (
  id uuid primary key default gen_random_uuid(),
  request_link_id uuid not null references request_links.request_link_registry(id) on delete cascade,
  document_id uuid not null,
  submitted_by text null,
  submitted_labels jsonb not null default '{}'::jsonb,
  updated_version_id uuid not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_request_link_registry_document
  on request_links.request_link_registry(document_id, created_at desc);

create index if not exists idx_request_link_registry_status_expires
  on request_links.request_link_registry(status, expires_at);

create index if not exists idx_request_link_submit_audits_request_link
  on request_links.request_link_submit_audits(request_link_id, created_at desc);

drop trigger if exists set_request_link_registry_updated_at on request_links.request_link_registry;
create trigger set_request_link_registry_updated_at
before update on request_links.request_link_registry
for each row
execute function request_links.set_updated_at();

comment on schema request_links is 'REQ-LINK request link domain schema';
comment on table request_links.request_link_registry is 'REQ-LINK-01 token-hash based limited edit links';
comment on table request_links.request_link_submit_audits is 'REQ-LINK-04 submit audit log';

-- SITE-CHECK-01
-- 현장별 필요 서류 누락 방지 기능의 1차 저장 구조를 생성합니다.
-- 실행 위치: Supabase SQL Editor
--
-- 중요:
-- 1. 이 파일은 실행 전 SQL 이므로 docs/ 에 보관합니다.
-- 2. 실행 완료 후 아카이브가 필요하면 docs/applied/ 로 이동합니다.
-- 3. 앱 코드가 schema('sites') 를 사용하므로, 실행 후 runtime 에서
--    "Invalid schema: sites" 류 오류가 나오면 아래도 함께 적용해야 합니다.
--
-- ALTER ROLE authenticator SET pgrst.db_schemas = 'public, signing, documents, sites';
-- NOTIFY pgrst, 'reload config';
-- NOTIFY pgrst, 'reload schema';

create extension if not exists pgcrypto;

create schema if not exists sites;

grant usage on schema sites to service_role;
grant all on all tables in schema sites to service_role;
grant all on all sequences in schema sites to service_role;
grant all on all routines in schema sites to service_role;
alter default privileges for role postgres in schema sites grant all on tables to service_role;
alter default privileges for role postgres in schema sites grant all on sequences to service_role;
alter default privileges for role postgres in schema sites grant all on routines to service_role;

create table if not exists sites.site_registry (
  id uuid primary key default gen_random_uuid(),
  site_name text not null,
  trade_keys text[] not null default '{}',
  open_date date not null,
  checklist_version integer not null default 0 check (checklist_version >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists sites.required_document_rules (
  id uuid primary key default gen_random_uuid(),
  trade_key text not null,
  document_type_key text not null,
  document_title text not null,
  description text null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (trade_key, document_type_key)
);

create table if not exists sites.site_checklist_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites.site_registry(id) on delete cascade,
  checklist_version integer not null check (checklist_version >= 1),
  generated_at timestamptz not null default timezone('utc', now()),
  unique (site_id, checklist_version)
);

create table if not exists sites.site_checklist_items (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites.site_registry(id) on delete cascade,
  checklist_snapshot_id uuid not null references sites.site_checklist_snapshots(id) on delete cascade,
  checklist_version integer not null check (checklist_version >= 1),
  document_type_key text not null,
  document_title text not null,
  source_trade_keys text[] not null default '{}',
  status text not null check (status in ('missing', 'completed')),
  linked_document_id uuid null,
  generated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_site_registry_updated_at
  on sites.site_registry(updated_at desc);

create index if not exists idx_required_document_rules_trade_key
  on sites.required_document_rules(trade_key, document_type_key);

create index if not exists idx_site_checklist_snapshots_site_version
  on sites.site_checklist_snapshots(site_id, checklist_version desc);

create index if not exists idx_site_checklist_items_site_version
  on sites.site_checklist_items(site_id, checklist_version, document_type_key);

create or replace function sites.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_site_registry_updated_at on sites.site_registry;
create trigger set_site_registry_updated_at
before update on sites.site_registry
for each row
execute function sites.set_updated_at();

drop trigger if exists set_required_document_rules_updated_at on sites.required_document_rules;
create trigger set_required_document_rules_updated_at
before update on sites.required_document_rules
for each row
execute function sites.set_updated_at();

comment on schema sites is 'SITE-CHECK-01 site checklist domain schema';
comment on table sites.site_registry is 'SITE-CHECK-01 site metadata registry';
comment on table sites.required_document_rules is 'SITE-CHECK-01 trade to required document rules';
comment on table sites.site_checklist_snapshots is 'SITE-CHECK-02 generated site checklist snapshots';
comment on table sites.site_checklist_items is 'SITE-CHECK-03 deduplicated site checklist items';

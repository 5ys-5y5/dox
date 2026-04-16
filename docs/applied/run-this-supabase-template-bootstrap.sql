-- TPL-REG-01
-- 템플릿 등록 기능의 1차 저장 구조를 생성합니다.
-- 실행 위치: Supabase SQL Editor
--
-- 중요:
-- 1. 이 파일은 실행 전 SQL 이므로 docs/ 에 보관합니다.
-- 2. 실행 완료 후 아카이브가 필요하면 docs/applied/ 로 이동합니다.
-- 3. 앱 코드가 schema('templates') 를 사용하므로, 실행 후 runtime 에서
--    "Invalid schema: templates" 류 오류가 나오면 아래도 함께 적용해야 합니다.
--
-- ALTER ROLE authenticator SET pgrst.db_schemas = 'public, signing, documents, sites, templates';
-- NOTIFY pgrst, 'reload config';
-- NOTIFY pgrst, 'reload schema';

create extension if not exists pgcrypto;

create schema if not exists templates;

grant usage on schema templates to service_role;
grant all on all tables in schema templates to service_role;
grant all on all sequences in schema templates to service_role;
grant all on all routines in schema templates to service_role;
alter default privileges for role postgres in schema templates grant all on tables to service_role;
alter default privileges for role postgres in schema templates grant all on sequences to service_role;
alter default privileges for role postgres in schema templates grant all on routines to service_role;

create table if not exists templates.template_registry (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  source_document_name text null,
  source_document_id uuid null,
  draft_html text not null,
  layout_resize_mode text not null
    check (layout_resize_mode in ('fixed', 'grow_height', 'grow_width')),
  status text not null default 'draft'
    check (status in ('draft', 'active')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists templates.template_field_definitions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates.template_registry(id) on delete cascade,
  field_key text not null,
  field_type text not null
    check (field_type in ('text', 'textarea', 'date', 'number', 'select', 'checkbox', 'signature')),
  field_label text not null,
  required boolean not null default false,
  placeholder text null,
  default_value jsonb null,
  options text[] not null default '{}',
  layout_block_id text null,
  sort_order integer not null default 0,
  unique (template_id, field_key)
);

create table if not exists templates.template_label_bindings (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates.template_registry(id) on delete cascade,
  field_key text null,
  label_key text not null,
  binding_scope text not null check (binding_scope in ('field', 'signature'))
);

create table if not exists templates.template_signature_areas (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates.template_registry(id) on delete cascade,
  label_key text not null,
  signer_role_name text not null,
  page_index integer not null default 1 check (page_index >= 1),
  x numeric(12,2) not null,
  y numeric(12,2) not null,
  width numeric(12,2) not null check (width > 0),
  height numeric(12,2) not null check (height > 0),
  required boolean not null default true,
  sort_order integer not null default 0
);

create index if not exists idx_template_registry_updated_at
  on templates.template_registry(updated_at desc);

create index if not exists idx_template_field_definitions_template
  on templates.template_field_definitions(template_id, sort_order);

create index if not exists idx_template_label_bindings_template
  on templates.template_label_bindings(template_id, label_key);

create index if not exists idx_template_signature_areas_template
  on templates.template_signature_areas(template_id, sort_order);

create or replace function templates.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_template_registry_updated_at on templates.template_registry;
create trigger set_template_registry_updated_at
before update on templates.template_registry
for each row
execute function templates.set_updated_at();

comment on schema templates is 'TPL-REG-01 template registration domain schema';
comment on table templates.template_registry is 'TPL-REG-01 template metadata and draft html';
comment on table templates.template_field_definitions is 'TPL-REG-02 field schema definitions';
comment on table templates.template_label_bindings is 'TPL-REG-02 label bindings for field and signature scope';
comment on table templates.template_signature_areas is 'TPL-REG-04 signature areas with coordinates';

-- TPL-EXT-01
-- 템플릿 추출 기능의 1차 저장 구조를 생성합니다.
-- 실행 위치: Supabase SQL Editor
--
-- 중요:
-- 1. 이 파일은 실행 전 SQL 이므로 docs/ 에 보관합니다.
-- 2. 실행 완료 후 아카이브가 필요하면 docs/applied/ 로 이동합니다.
-- 3. 앱 코드가 schema('template_extracts') 를 사용하므로, 실행 후 runtime 에서
--    "Invalid schema: template_extracts" 류 오류가 나오면 아래도 함께 적용해야 합니다.
--
-- ALTER ROLE authenticator SET pgrst.db_schemas = 'public, signing, documents, sites, templates, template_extracts';
-- NOTIFY pgrst, 'reload config';
-- NOTIFY pgrst, 'reload schema';

create extension if not exists pgcrypto;

create schema if not exists template_extracts;

grant usage on schema template_extracts to service_role;
grant all on all tables in schema template_extracts to service_role;
grant all on all sequences in schema template_extracts to service_role;
grant all on all routines in schema template_extracts to service_role;
alter default privileges for role postgres in schema template_extracts grant all on tables to service_role;
alter default privileges for role postgres in schema template_extracts grant all on sequences to service_role;
alter default privileges for role postgres in schema template_extracts grant all on routines to service_role;

create table if not exists template_extracts.extract_drafts (
  id uuid primary key default gen_random_uuid(),
  source_title text null,
  source_kind text not null
    check (source_kind in ('html', 'text')),
  source_content text not null,
  generated_draft_html text not null,
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'rejected')),
  confidence_summary jsonb not null default '{}'::jsonb,
  similar_template_ids uuid[] not null default '{}',
  approved_template_id uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists template_extracts.extract_field_candidates (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references template_extracts.extract_drafts(id) on delete cascade,
  candidate_key text not null,
  field_key text not null,
  label_key text not null,
  field_type text not null
    check (field_type in ('text', 'textarea', 'date', 'number', 'select', 'checkbox', 'signature')),
  field_label text not null,
  detected_value text null,
  placeholder text null,
  default_value jsonb null,
  options text[] not null default '{}',
  required boolean not null default false,
  layout_block_id text null,
  confidence_score numeric(5,4) not null
    check (confidence_score >= 0 and confidence_score <= 1),
  review_status text not null default 'review_needed'
    check (review_status in ('accepted', 'review_needed', 'rejected')),
  extraction_reason text null,
  sort_order integer not null default 0,
  unique (draft_id, candidate_key)
);

create index if not exists idx_extract_drafts_updated_at
  on template_extracts.extract_drafts(updated_at desc);

create index if not exists idx_extract_field_candidates_draft
  on template_extracts.extract_field_candidates(draft_id, sort_order);

create or replace function template_extracts.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_extract_drafts_updated_at on template_extracts.extract_drafts;
create trigger set_extract_drafts_updated_at
before update on template_extracts.extract_drafts
for each row
execute function template_extracts.set_updated_at();

comment on schema template_extracts is 'TPL-EXT-01 template extraction domain schema';
comment on table template_extracts.extract_drafts is 'TPL-EXT-01 extraction drafts before template registration approval';
comment on table template_extracts.extract_field_candidates is 'TPL-EXT-03 extracted candidate fields with review status';

-- PHOTO-LABEL-01
-- 사진 라벨링 기능의 1차 저장 구조를 생성합니다.
-- 실행 위치: Supabase SQL Editor
--
-- 중요:
-- 1. 이 파일은 실행 전 SQL 이므로 docs/ 에 보관합니다.
-- 2. 실행 완료 후 아카이브가 필요하면 docs/applied/ 로 이동합니다.
-- 3. 앱 코드가 schema('photo_labels') 를 사용하므로, 실행 후 runtime 에서
--    "Invalid schema: photo_labels" 류 오류가 나오면 아래도 함께 적용해야 합니다.
--
-- ALTER ROLE authenticator SET pgrst.db_schemas = 'public, signing, documents, sites, templates, template_extracts, photo_labels';
-- NOTIFY pgrst, 'reload config';
-- NOTIFY pgrst, 'reload schema';

create extension if not exists pgcrypto;

create schema if not exists photo_labels;

grant usage on schema photo_labels to service_role;
grant all on all tables in schema photo_labels to service_role;
grant all on all sequences in schema photo_labels to service_role;
grant all on all routines in schema photo_labels to service_role;
alter default privileges for role postgres in schema photo_labels grant all on tables to service_role;
alter default privileges for role postgres in schema photo_labels grant all on sequences to service_role;
alter default privileges for role postgres in schema photo_labels grant all on routines to service_role;

create table if not exists photo_labels.photo_registry (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  photo_url text null,
  storage_path text null,
  photo_title text null,
  description text null,
  captured_at timestamptz null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint chk_photo_registry_reference_required
    check (photo_url is not null or storage_path is not null)
);

create table if not exists photo_labels.photo_label_assignments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photo_labels.photo_registry(id) on delete cascade,
  label_key text not null,
  note text null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (photo_id, label_key)
);

create table if not exists photo_labels.photo_label_suggestions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references photo_labels.photo_registry(id) on delete cascade,
  label_key text not null,
  confidence_score numeric(5,4) not null
    check (confidence_score >= 0 and confidence_score <= 1),
  suggestion_reason text null,
  suggestion_status text not null default 'review_needed'
    check (suggestion_status in ('review_needed', 'accepted', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (photo_id, label_key)
);

create index if not exists idx_photo_registry_site_created_at
  on photo_labels.photo_registry(site_id, created_at desc);

create index if not exists idx_photo_label_assignments_photo
  on photo_labels.photo_label_assignments(photo_id);

create index if not exists idx_photo_label_suggestions_photo
  on photo_labels.photo_label_suggestions(photo_id);

create or replace function photo_labels.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_photo_registry_updated_at on photo_labels.photo_registry;
create trigger set_photo_registry_updated_at
before update on photo_labels.photo_registry
for each row
execute function photo_labels.set_updated_at();

comment on schema photo_labels is 'PHOTO-LABEL-01 photo label domain schema';
comment on table photo_labels.photo_registry is 'PHOTO-LABEL-01 photo metadata linked by site_id';
comment on table photo_labels.photo_label_assignments is 'PHOTO-LABEL-02 manually confirmed labels';
comment on table photo_labels.photo_label_suggestions is 'PHOTO-LABEL-03 suggested labels that require review';

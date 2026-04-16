-- PHOTO-LABEL-04
-- 사진 요구 라벨 규칙과 누락 경고 계산용 저장 구조를 생성합니다.
-- 실행 위치: Supabase SQL Editor
--
-- 중요:
-- 1. 이 파일은 실행 전 SQL 이므로 docs/ 에 보관합니다.
-- 2. 실행 완료 후 아카이브가 필요하면 docs/applied/ 로 이동합니다.
-- 3. 이 파일은 기존 docs/run-this-supabase-photo-label-bootstrap.sql 이 먼저 적용된 상태를 기준으로 합니다.

create schema if not exists photo_labels;

grant usage on schema photo_labels to service_role;
grant all on all tables in schema photo_labels to service_role;
grant all on all sequences in schema photo_labels to service_role;
grant all on all routines in schema photo_labels to service_role;
alter default privileges for role postgres in schema photo_labels grant all on tables to service_role;
alter default privileges for role postgres in schema photo_labels grant all on sequences to service_role;
alter default privileges for role postgres in schema photo_labels grant all on routines to service_role;

create or replace function photo_labels.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create table if not exists photo_labels.site_photo_label_requirements (
  id uuid primary key default gen_random_uuid(),
  site_id text not null,
  label_key text not null,
  label_name text not null,
  description text null,
  document_type_key text null,
  minimum_photo_count integer not null default 1
    check (minimum_photo_count > 0),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists uq_site_photo_label_requirements_site_label_doc
  on photo_labels.site_photo_label_requirements(
    site_id,
    label_key,
    coalesce(document_type_key, '')
  );

create index if not exists idx_site_photo_label_requirements_site_active
  on photo_labels.site_photo_label_requirements(site_id, active, label_key);

drop trigger if exists set_site_photo_label_requirements_updated_at on photo_labels.site_photo_label_requirements;
create trigger set_site_photo_label_requirements_updated_at
before update on photo_labels.site_photo_label_requirements
for each row
execute function photo_labels.set_updated_at();

comment on table photo_labels.site_photo_label_requirements is 'PHOTO-LABEL-04 required photo labels per site and optional document type';

-- MEMBER-ACCESS-01
-- 번호 + 인증번호 기반 초대형 접근 권한의 최소 스키마입니다.
-- 실행 위치: Supabase SQL Editor
--
-- 목적:
-- - 서비스 사용자를 휴대폰 번호 기준으로 식별
-- - 초대한 사람이 철회하기 전까지 초대가 계속 유효
-- - 프로젝트(현장) 단위 권한과 문서 단위 권한을 분리
-- - 이후 문서 수정/서명 주체 추적에 사용할 수 있는 member id 기반을 준비
--
-- 중요:
-- 1. 인증번호는 만료시간을 두지 않습니다. 초대가 active 인 동안 계속 유효합니다.
-- 2. 실제 서비스 접근 게이트는 앱 코드에서 member_access.member_registry + memberships 를 읽어 판단합니다.
-- 3. 실행 후 Data API/PostgREST 에서 새 스키마가 안 보이면 아래를 추가 실행해야 합니다.
--
-- ALTER ROLE authenticator
--   SET pgrst.db_schemas = 'public, signing, documents, sites, templates, template_extracts, photo_labels, bulk_ops, request_links, exports, messaging, member_access';
-- NOTIFY pgrst, 'reload config';
-- NOTIFY pgrst, 'reload schema';

create extension if not exists pgcrypto;

create schema if not exists member_access;

grant usage on schema member_access to service_role;
grant all on all tables in schema member_access to service_role;
grant all on all sequences in schema member_access to service_role;
grant all on all routines in schema member_access to service_role;
alter default privileges for role postgres in schema member_access grant all on tables to service_role;
alter default privileges for role postgres in schema member_access grant all on sequences to service_role;
alter default privileges for role postgres in schema member_access grant all on routines to service_role;

create or replace function member_access.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists member_access.member_registry (
  id uuid not null default gen_random_uuid(),
  phone_number text not null,
  display_name text null,
  verification_status text not null default 'invited'::text,
  active_access_code_hash text not null,
  active_access_code_last_sent_at timestamp with time zone null,
  last_verified_at timestamp with time zone null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint member_registry_pkey primary key (id),
  constraint member_registry_phone_number_key unique (phone_number),
  constraint member_registry_verification_status_check check (
    verification_status = any (array['invited'::text, 'verified'::text, 'revoked'::text])
  ),
  constraint member_registry_access_code_hash_check check (active_access_code_hash ~ '^[a-f0-9]{64}$'::text)
);

create table if not exists member_access.member_invites (
  id uuid not null default gen_random_uuid(),
  member_id uuid not null,
  invite_status text not null default 'active'::text,
  invited_by_member_id uuid null,
  invite_note text null,
  revoked_at timestamp with time zone null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint member_invites_pkey primary key (id),
  constraint member_invites_member_id_key unique (member_id),
  constraint member_invites_member_id_fkey foreign key (member_id)
    references member_access.member_registry(id) on delete cascade,
  constraint member_invites_invited_by_member_id_fkey foreign key (invited_by_member_id)
    references member_access.member_registry(id) on delete set null,
  constraint member_invites_status_check check (
    invite_status = any (array['active'::text, 'revoked'::text])
  )
);

create table if not exists member_access.member_verification_events (
  id uuid not null default gen_random_uuid(),
  member_id uuid not null,
  phone_number text not null,
  verification_source text not null default 'sms_code'::text,
  verification_status text not null,
  request_payload jsonb not null default '{}'::jsonb,
  verified_at timestamp with time zone null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint member_verification_events_pkey primary key (id),
  constraint member_verification_events_member_id_fkey foreign key (member_id)
    references member_access.member_registry(id) on delete cascade,
  constraint member_verification_events_source_check check (
    verification_source = any (array['sms_code'::text])
  ),
  constraint member_verification_events_status_check check (
    verification_status = any (array['sent'::text, 'verified'::text, 'failed'::text])
  ),
  constraint member_verification_events_request_payload_check check (jsonb_typeof(request_payload) = 'object'::text)
);

create table if not exists member_access.site_memberships (
  id uuid not null default gen_random_uuid(),
  member_id uuid not null,
  site_id uuid not null,
  access_role text not null,
  created_by_member_id uuid null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint site_memberships_pkey primary key (id),
  constraint site_memberships_member_site_key unique (member_id, site_id),
  constraint site_memberships_member_id_fkey foreign key (member_id)
    references member_access.member_registry(id) on delete cascade,
  constraint site_memberships_site_id_fkey foreign key (site_id)
    references sites.site_registry(id) on delete cascade,
  constraint site_memberships_created_by_member_id_fkey foreign key (created_by_member_id)
    references member_access.member_registry(id) on delete set null,
  constraint site_memberships_access_role_check check (
    access_role = any (array['owner'::text, 'manager'::text, 'editor'::text, 'viewer'::text])
  )
);

create table if not exists member_access.document_memberships (
  id uuid not null default gen_random_uuid(),
  member_id uuid not null,
  document_id uuid not null,
  access_role text not null,
  created_by_member_id uuid null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint document_memberships_pkey primary key (id),
  constraint document_memberships_member_document_key unique (member_id, document_id),
  constraint document_memberships_member_id_fkey foreign key (member_id)
    references member_access.member_registry(id) on delete cascade,
  constraint document_memberships_document_id_fkey foreign key (document_id)
    references documents.document_registry(id) on delete cascade,
  constraint document_memberships_created_by_member_id_fkey foreign key (created_by_member_id)
    references member_access.member_registry(id) on delete set null,
  constraint document_memberships_access_role_check check (
    access_role = any (array['editor'::text, 'viewer'::text, 'signer'::text])
  )
);

create index if not exists idx_member_registry_phone_number
  on member_access.member_registry using btree (phone_number);

create index if not exists idx_member_verification_events_member_created_at
  on member_access.member_verification_events using btree (member_id, created_at desc);

create index if not exists idx_site_memberships_site_id
  on member_access.site_memberships using btree (site_id, updated_at desc);

create index if not exists idx_document_memberships_document_id
  on member_access.document_memberships using btree (document_id, updated_at desc);

drop trigger if exists set_member_registry_updated_at on member_access.member_registry;
create trigger set_member_registry_updated_at
before update on member_access.member_registry
for each row
execute function member_access.set_updated_at();

drop trigger if exists set_member_invites_updated_at on member_access.member_invites;
create trigger set_member_invites_updated_at
before update on member_access.member_invites
for each row
execute function member_access.set_updated_at();

drop trigger if exists set_site_memberships_updated_at on member_access.site_memberships;
create trigger set_site_memberships_updated_at
before update on member_access.site_memberships
for each row
execute function member_access.set_updated_at();

drop trigger if exists set_document_memberships_updated_at on member_access.document_memberships;
create trigger set_document_memberships_updated_at
before update on member_access.document_memberships
for each row
execute function member_access.set_updated_at();

comment on schema member_access is '번호 기반 초대형 접근 권한 관리';
comment on table member_access.member_registry is '휴대폰 번호 기준 멤버 정본과 현재 접근 인증번호';
comment on table member_access.member_invites is '초대 활성/철회 상태. 초대는 만료되지 않음';
comment on table member_access.member_verification_events is '문자 발송/인증 성공/실패 이력';
comment on table member_access.site_memberships is '프로젝트(현장) 단위 접근 권한';
comment on table member_access.document_memberships is '문서 단위 접근 권한';

select
  to_regclass('member_access.member_registry') as member_registry_table,
  to_regclass('member_access.member_invites') as member_invites_table,
  to_regclass('member_access.member_verification_events') as member_verification_events_table,
  to_regclass('member_access.site_memberships') as site_memberships_table,
  to_regclass('member_access.document_memberships') as document_memberships_table;

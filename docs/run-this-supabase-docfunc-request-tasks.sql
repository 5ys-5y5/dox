-- DOCFUNC-10
-- /documents owner 요청 링크 설정에서 선택한 값, 서명, 필수 사진, 필수 파일 task를 저장합니다.
-- 실행 위치: Supabase SQL Editor
--
-- 실행 전제:
--   docs/applied/run-this-supabase-document-bootstrap.sql
--   docs/applied/run-this-supabase-request-links-bootstrap.sql
--   docs/run-this-supabase-member-access-schema.sql

create table if not exists documents.document_request_tasks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents.document_registry(id) on delete cascade,
  request_link_id uuid null references request_links.request_link_registry(id) on delete set null,
  assignee_member_id uuid not null references member_access.member_registry(id) on delete cascade,
  task_kind text not null check (task_kind in ('value', 'signature', 'photo', 'file')),
  target_key text not null check (btrim(target_key) <> ''),
  target_label text not null check (btrim(target_label) <> ''),
  value_key text null,
  slot_key text null,
  frame_group_id text null,
  required_count integer null check (required_count is null or required_count >= 1),
  linked_external_id text null,
  status text not null default 'requested'
    check (status in ('draft', 'requested', 'submitted', 'completed', 'revoked')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_document_request_tasks_document
  on documents.document_request_tasks(document_id, created_at desc);

create index if not exists idx_document_request_tasks_request_link
  on documents.document_request_tasks(request_link_id, created_at desc);

create index if not exists idx_document_request_tasks_assignee
  on documents.document_request_tasks(assignee_member_id, status, created_at desc);

drop trigger if exists set_document_request_tasks_updated_at on documents.document_request_tasks;
create trigger set_document_request_tasks_updated_at
before update on documents.document_request_tasks
for each row
execute function documents.set_document_registry_updated_at();

comment on table documents.document_request_tasks is 'DOCFUNC-10 request link scoped document tasks owned by /documents';

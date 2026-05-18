-- DOC-TPL-LINK-V2
-- 템플릿 편집기에서 보정/이동/런타임/상자 타입/관계/위치 설정을 구조적으로 저장하고,
-- 템플릿 변경 시 연결된 문서가 함께 동기화되도록 하는 2차 스키마입니다.
--
-- 목표:
-- 1. 템플릿의 HTML만이 아니라 프레임 단위 메타데이터를 별도 테이블에 정규화 저장한다.
-- 2. 문서는 템플릿과 링크되며, 템플릿 리비전이 바뀌면 문서 스냅샷도 함께 갱신된다.
-- 3. 같은 value_key 를 공유하는 value 상자는 문서 값 1건으로 일괄 갱신된다.
--
-- 실행 위치: Supabase SQL Editor
--
-- 중요:
-- - 이 파일은 기존 templates / documents 스키마가 이미 존재한다는 전제입니다.
-- - 현재 앱 코드는 아직 draft_html / html_canonical 중심입니다.
--   이 스키마를 실제로 쓰려면 템플릿 저장/문서 렌더/문서 저장 코드를
--   아래 신규 테이블 기준으로 전환해야 합니다.

create extension if not exists pgcrypto;

create schema if not exists templates;
create schema if not exists documents;

grant usage on schema templates to service_role;
grant usage on schema documents to service_role;
grant all on all tables in schema templates to service_role;
grant all on all tables in schema documents to service_role;
grant all on all sequences in schema templates to service_role;
grant all on all sequences in schema documents to service_role;
grant all on all routines in schema templates to service_role;
grant all on all routines in schema documents to service_role;

alter table if exists templates.template_registry
  add column if not exists current_revision_id uuid null;

create table if not exists templates.template_revisions (
  id uuid not null default gen_random_uuid(),
  template_id uuid not null,
  revision_number integer not null,
  draft_html text not null,
  layout_resize_mode text not null,
  render_snapshot_html text not null,
  frame_schema_json jsonb not null default '[]'::jsonb,
  relation_schema_json jsonb not null default '[]'::jsonb,
  created_by text null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint template_revisions_pkey primary key (id),
  constraint template_revisions_template_id_fkey foreign key (template_id)
    references templates.template_registry(id) on delete cascade,
  constraint template_revisions_revision_number_check check (revision_number >= 1),
  constraint template_revisions_layout_resize_mode_check check (
    layout_resize_mode = any (array['fixed'::text, 'grow_height'::text, 'grow_width'::text])
  ),
  constraint template_revisions_frame_schema_json_check check (jsonb_typeof(frame_schema_json) = 'array'::text),
  constraint template_revisions_relation_schema_json_check check (jsonb_typeof(relation_schema_json) = 'array'::text),
  constraint template_revisions_template_revision_key unique (template_id, revision_number)
);

create table if not exists templates.template_revision_frames (
  id uuid not null default gen_random_uuid(),
  template_revision_id uuid not null,
  frame_group_id text not null,
  label text not null default ''::text,
  role text not null,
  box_kind text null,
  value_key text null,
  parent_group_id text null,
  runtime_mode text null,
  field_type text null,
  page_number integer not null default 1,
  sort_order integer not null default 0,
  frame_snapshot jsonb not null default '{}'::jsonb,
  style_snapshot jsonb not null default '{}'::jsonb,
  position_snapshot jsonb not null default '{}'::jsonb,
  relation_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint template_revision_frames_pkey primary key (id),
  constraint template_revision_frames_template_revision_id_fkey foreign key (template_revision_id)
    references templates.template_revisions(id) on delete cascade,
  constraint template_revision_frames_role_check check (
    role = any (array['group'::text, 'key'::text, 'value'::text, 'key_value'::text])
  ),
  constraint template_revision_frames_box_kind_check check (
    box_kind is null or box_kind = any (array['text'::text, 'attachment'::text, 'signature'::text])
  ),
  constraint template_revision_frames_runtime_mode_check check (
    runtime_mode is null or runtime_mode = any (
      array[
        'static_label'::text,
        'editable_text'::text,
        'file_slot'::text,
        'signature_image'::text,
        'signature_history'::text,
        'signature_signer_name'::text,
        'signature_signed_at'::text,
        'signature_provider'::text,
        'signature_status'::text
      ]
    )
  ),
  constraint template_revision_frames_page_number_check check (page_number >= 1),
  constraint template_revision_frames_sort_order_check check (sort_order >= 0),
  constraint template_revision_frames_frame_snapshot_check check (jsonb_typeof(frame_snapshot) = 'object'::text),
  constraint template_revision_frames_style_snapshot_check check (jsonb_typeof(style_snapshot) = 'object'::text),
  constraint template_revision_frames_position_snapshot_check check (jsonb_typeof(position_snapshot) = 'object'::text),
  constraint template_revision_frames_relation_snapshot_check check (jsonb_typeof(relation_snapshot) = 'object'::text),
  constraint template_revision_frames_revision_frame_group_key unique (template_revision_id, frame_group_id)
);

create table if not exists templates.template_revision_bindings (
  id uuid not null default gen_random_uuid(),
  template_revision_id uuid not null,
  binding_type text not null,
  source_frame_group_id text not null,
  target_frame_group_id text not null,
  shared_value_key text null,
  sort_order integer not null default 0,
  binding_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint template_revision_bindings_pkey primary key (id),
  constraint template_revision_bindings_template_revision_id_fkey foreign key (template_revision_id)
    references templates.template_revisions(id) on delete cascade,
  constraint template_revision_bindings_type_check check (
    binding_type = any (array['parent'::text, 'value'::text])
  ),
  constraint template_revision_bindings_sort_order_check check (sort_order >= 0),
  constraint template_revision_bindings_snapshot_check check (jsonb_typeof(binding_snapshot) = 'object'::text)
);

create table if not exists templates.template_revision_position_relations (
  id uuid not null default gen_random_uuid(),
  template_revision_id uuid not null,
  relation_key text not null,
  target_kind text not null,
  target_group_id text null,
  target_frame_group_ids jsonb not null default '[]'::jsonb,
  anchor_kind text not null,
  anchor_group_id text null,
  anchor_frame_group_id text null,
  anchor_page_corner_id text null,
  gap_y_px numeric(12,2) null,
  sort_order integer not null default 0,
  relation_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint template_revision_position_relations_pkey primary key (id),
  constraint template_revision_position_relations_template_revision_id_fkey foreign key (template_revision_id)
    references templates.template_revisions(id) on delete cascade,
  constraint template_revision_position_relations_target_kind_check check (
    target_kind = any (array['frame'::text, 'group'::text])
  ),
  constraint template_revision_position_relations_anchor_kind_check check (
    anchor_kind = any (array['frame'::text, 'group'::text, 'page-corner'::text])
  ),
  constraint template_revision_position_relations_target_frame_group_ids_check check (
    jsonb_typeof(target_frame_group_ids) = 'array'::text
  ),
  constraint template_revision_position_relations_sort_order_check check (sort_order >= 0),
  constraint template_revision_position_relations_snapshot_check check (jsonb_typeof(relation_snapshot) = 'object'::text),
  constraint template_revision_position_relations_revision_relation_key unique (template_revision_id, relation_key)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_template_registry_current_revision'
      and conrelid = 'templates.template_registry'::regclass
  ) then
    alter table templates.template_registry
      add constraint fk_template_registry_current_revision
      foreign key (current_revision_id)
      references templates.template_revisions(id)
      on delete set null;
  end if;
end;
$$;

create table if not exists documents.document_template_links (
  document_id uuid not null,
  template_id uuid not null,
  template_revision_id uuid null,
  sync_mode text not null default 'follow_latest'::text,
  auto_sync boolean not null default true,
  last_synced_revision_id uuid null,
  linked_at timestamp with time zone not null default timezone('utc'::text, now()),
  last_synced_at timestamp with time zone null,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint document_template_links_pkey primary key (document_id),
  constraint document_template_links_document_id_fkey foreign key (document_id)
    references documents.document_registry(id) on delete cascade,
  constraint document_template_links_template_id_fkey foreign key (template_id)
    references templates.template_registry(id) on delete restrict,
  constraint document_template_links_template_revision_id_fkey foreign key (template_revision_id)
    references templates.template_revisions(id) on delete set null,
  constraint document_template_links_last_synced_revision_id_fkey foreign key (last_synced_revision_id)
    references templates.template_revisions(id) on delete set null,
  constraint document_template_links_sync_mode_check check (
    sync_mode = any (array['follow_latest'::text, 'freeze_revision'::text])
  )
);

create table if not exists documents.document_frame_snapshots (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null,
  template_revision_id uuid not null,
  template_frame_id uuid not null,
  frame_group_id text not null,
  label text not null default ''::text,
  role text not null,
  box_kind text null,
  value_key text null,
  parent_group_id text null,
  runtime_mode text null,
  field_type text null,
  page_number integer not null default 1,
  sort_order integer not null default 0,
  frame_snapshot jsonb not null default '{}'::jsonb,
  style_snapshot jsonb not null default '{}'::jsonb,
  position_snapshot jsonb not null default '{}'::jsonb,
  relation_snapshot jsonb not null default '{}'::jsonb,
  synced_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint document_frame_snapshots_pkey primary key (id),
  constraint document_frame_snapshots_document_id_fkey foreign key (document_id)
    references documents.document_registry(id) on delete cascade,
  constraint document_frame_snapshots_template_revision_id_fkey foreign key (template_revision_id)
    references templates.template_revisions(id) on delete cascade,
  constraint document_frame_snapshots_template_frame_id_fkey foreign key (template_frame_id)
    references templates.template_revision_frames(id) on delete cascade,
  constraint document_frame_snapshots_role_check check (
    role = any (array['group'::text, 'key'::text, 'value'::text, 'key_value'::text])
  ),
  constraint document_frame_snapshots_box_kind_check check (
    box_kind is null or box_kind = any (array['text'::text, 'attachment'::text, 'signature'::text])
  ),
  constraint document_frame_snapshots_runtime_mode_check check (
    runtime_mode is null or runtime_mode = any (
      array[
        'static_label'::text,
        'editable_text'::text,
        'file_slot'::text,
        'signature_image'::text,
        'signature_history'::text,
        'signature_signer_name'::text,
        'signature_signed_at'::text,
        'signature_provider'::text,
        'signature_status'::text
      ]
    )
  ),
  constraint document_frame_snapshots_page_number_check check (page_number >= 1),
  constraint document_frame_snapshots_sort_order_check check (sort_order >= 0),
  constraint document_frame_snapshots_frame_snapshot_check check (jsonb_typeof(frame_snapshot) = 'object'::text),
  constraint document_frame_snapshots_style_snapshot_check check (jsonb_typeof(style_snapshot) = 'object'::text),
  constraint document_frame_snapshots_position_snapshot_check check (jsonb_typeof(position_snapshot) = 'object'::text),
  constraint document_frame_snapshots_relation_snapshot_check check (jsonb_typeof(relation_snapshot) = 'object'::text),
  constraint document_frame_snapshots_document_template_frame_key unique (document_id, template_frame_id)
);

create table if not exists documents.document_frame_bindings (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null,
  template_revision_id uuid not null,
  template_binding_id uuid not null,
  binding_type text not null,
  source_frame_group_id text not null,
  target_frame_group_id text not null,
  shared_value_key text null,
  sort_order integer not null default 0,
  binding_snapshot jsonb not null default '{}'::jsonb,
  synced_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint document_frame_bindings_pkey primary key (id),
  constraint document_frame_bindings_document_id_fkey foreign key (document_id)
    references documents.document_registry(id) on delete cascade,
  constraint document_frame_bindings_template_revision_id_fkey foreign key (template_revision_id)
    references templates.template_revisions(id) on delete cascade,
  constraint document_frame_bindings_template_binding_id_fkey foreign key (template_binding_id)
    references templates.template_revision_bindings(id) on delete cascade,
  constraint document_frame_bindings_type_check check (
    binding_type = any (array['parent'::text, 'value'::text])
  ),
  constraint document_frame_bindings_sort_order_check check (sort_order >= 0),
  constraint document_frame_bindings_snapshot_check check (jsonb_typeof(binding_snapshot) = 'object'::text),
  constraint document_frame_bindings_document_template_binding_key unique (document_id, template_binding_id)
);

create table if not exists documents.document_position_relations (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null,
  template_revision_id uuid not null,
  template_position_relation_id uuid not null,
  relation_key text not null,
  target_kind text not null,
  target_group_id text null,
  target_frame_group_ids jsonb not null default '[]'::jsonb,
  anchor_kind text not null,
  anchor_group_id text null,
  anchor_frame_group_id text null,
  anchor_page_corner_id text null,
  gap_y_px numeric(12,2) null,
  sort_order integer not null default 0,
  relation_snapshot jsonb not null default '{}'::jsonb,
  synced_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint document_position_relations_pkey primary key (id),
  constraint document_position_relations_document_id_fkey foreign key (document_id)
    references documents.document_registry(id) on delete cascade,
  constraint document_position_relations_template_revision_id_fkey foreign key (template_revision_id)
    references templates.template_revisions(id) on delete cascade,
  constraint document_position_relations_template_position_relation_id_fkey foreign key (template_position_relation_id)
    references templates.template_revision_position_relations(id) on delete cascade,
  constraint document_position_relations_target_kind_check check (
    target_kind = any (array['frame'::text, 'group'::text])
  ),
  constraint document_position_relations_anchor_kind_check check (
    anchor_kind = any (array['frame'::text, 'group'::text, 'page-corner'::text])
  ),
  constraint document_position_relations_target_frame_group_ids_check check (
    jsonb_typeof(target_frame_group_ids) = 'array'::text
  ),
  constraint document_position_relations_sort_order_check check (sort_order >= 0),
  constraint document_position_relations_snapshot_check check (jsonb_typeof(relation_snapshot) = 'object'::text),
  constraint document_position_relations_document_template_position_relation_key unique (document_id, template_position_relation_id)
);

create table if not exists documents.document_value_entries (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null,
  value_key text not null,
  value_payload jsonb not null default '{}'::jsonb,
  display_text text null,
  updated_by text null,
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint document_value_entries_pkey primary key (id),
  constraint document_value_entries_document_id_fkey foreign key (document_id)
    references documents.document_registry(id) on delete cascade,
  constraint document_value_entries_value_key_check check (btrim(value_key) <> ''::text),
  constraint document_value_entries_payload_check check (jsonb_typeof(value_payload) = 'object'::text),
  constraint document_value_entries_document_value_key_key unique (document_id, value_key)
);

create table if not exists documents.document_template_sync_events (
  id uuid not null default gen_random_uuid(),
  document_id uuid not null,
  template_id uuid not null,
  from_revision_id uuid null,
  to_revision_id uuid null,
  sync_reason text not null,
  sync_status text not null,
  debug_payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  constraint document_template_sync_events_pkey primary key (id),
  constraint document_template_sync_events_document_id_fkey foreign key (document_id)
    references documents.document_registry(id) on delete cascade,
  constraint document_template_sync_events_template_id_fkey foreign key (template_id)
    references templates.template_registry(id) on delete cascade,
  constraint document_template_sync_events_from_revision_id_fkey foreign key (from_revision_id)
    references templates.template_revisions(id) on delete set null,
  constraint document_template_sync_events_to_revision_id_fkey foreign key (to_revision_id)
    references templates.template_revisions(id) on delete set null,
  constraint document_template_sync_events_reason_check check (
    sync_reason = any (array['initial_link'::text, 'template_revision_change'::text, 'manual_resync'::text])
  ),
  constraint document_template_sync_events_status_check check (
    sync_status = any (array['applied'::text, 'failed'::text])
  ),
  constraint document_template_sync_events_debug_payload_check check (jsonb_typeof(debug_payload) = 'object'::text)
);

create index if not exists idx_template_revisions_template_revision
  on templates.template_revisions using btree (template_id, revision_number desc);

create index if not exists idx_template_revision_frames_revision_sort
  on templates.template_revision_frames using btree (template_revision_id, sort_order, frame_group_id);

create index if not exists idx_template_revision_bindings_revision_sort
  on templates.template_revision_bindings using btree (template_revision_id, binding_type, sort_order);

create index if not exists idx_template_revision_position_relations_revision_sort
  on templates.template_revision_position_relations using btree (template_revision_id, sort_order);

create index if not exists idx_document_frame_snapshots_document_sort
  on documents.document_frame_snapshots using btree (document_id, sort_order, frame_group_id);

create index if not exists idx_document_frame_bindings_document_sort
  on documents.document_frame_bindings using btree (document_id, binding_type, sort_order);

create index if not exists idx_document_position_relations_document_sort
  on documents.document_position_relations using btree (document_id, sort_order, relation_key);

create index if not exists idx_document_value_entries_document_key
  on documents.document_value_entries using btree (document_id, value_key);

create index if not exists idx_document_template_sync_events_document_created
  on documents.document_template_sync_events using btree (document_id, created_at desc);

create or replace function documents.set_document_template_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_document_template_links_updated_at on documents.document_template_links;

create trigger set_document_template_links_updated_at
before update on documents.document_template_links
for each row
execute function documents.set_document_template_links_updated_at();

create or replace function documents.set_document_value_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_document_value_entries_updated_at on documents.document_value_entries;

create trigger set_document_value_entries_updated_at
before update on documents.document_value_entries
for each row
execute function documents.set_document_value_entries_updated_at();

create or replace function documents.sync_document_template_snapshot(p_document_id uuid, p_reason text default 'manual_resync')
returns void
language plpgsql
as $$
declare
  v_link documents.document_template_links%rowtype;
  v_registry templates.template_registry%rowtype;
  v_target_revision_id uuid;
begin
  select *
    into v_link
  from documents.document_template_links
  where document_id = p_document_id;

  if not found then
    raise exception 'document_template_links row not found for document_id=%', p_document_id;
  end if;

  select *
    into v_registry
  from templates.template_registry
  where id = v_link.template_id;

  if not found then
    raise exception 'template_registry row not found for template_id=%', v_link.template_id;
  end if;

  v_target_revision_id := case
    when v_link.sync_mode = 'freeze_revision' then coalesce(v_link.template_revision_id, v_registry.current_revision_id)
    else v_registry.current_revision_id
  end;

  if v_target_revision_id is null then
    raise exception 'target template revision not resolved for document_id=%', p_document_id;
  end if;

  delete from documents.document_position_relations
  where document_id = p_document_id;

  delete from documents.document_frame_bindings
  where document_id = p_document_id;

  delete from documents.document_frame_snapshots
  where document_id = p_document_id;

  insert into documents.document_frame_snapshots (
    document_id,
    template_revision_id,
    template_frame_id,
    frame_group_id,
    label,
    role,
    box_kind,
    value_key,
    parent_group_id,
    runtime_mode,
    field_type,
    page_number,
    sort_order,
    frame_snapshot,
    style_snapshot,
    position_snapshot,
    relation_snapshot
  )
  select
    p_document_id,
    f.template_revision_id,
    f.id,
    f.frame_group_id,
    f.label,
    f.role,
    f.box_kind,
    f.value_key,
    f.parent_group_id,
    f.runtime_mode,
    f.field_type,
    f.page_number,
    f.sort_order,
    f.frame_snapshot,
    f.style_snapshot,
    f.position_snapshot,
    f.relation_snapshot
  from templates.template_revision_frames f
  where f.template_revision_id = v_target_revision_id
  order by f.sort_order, f.frame_group_id;

  insert into documents.document_frame_bindings (
    document_id,
    template_revision_id,
    template_binding_id,
    binding_type,
    source_frame_group_id,
    target_frame_group_id,
    shared_value_key,
    sort_order,
    binding_snapshot
  )
  select
    p_document_id,
    b.template_revision_id,
    b.id,
    b.binding_type,
    b.source_frame_group_id,
    b.target_frame_group_id,
    b.shared_value_key,
    b.sort_order,
    b.binding_snapshot
  from templates.template_revision_bindings b
  where b.template_revision_id = v_target_revision_id
  order by b.sort_order, b.id;

  insert into documents.document_position_relations (
    document_id,
    template_revision_id,
    template_position_relation_id,
    relation_key,
    target_kind,
    target_group_id,
    target_frame_group_ids,
    anchor_kind,
    anchor_group_id,
    anchor_frame_group_id,
    anchor_page_corner_id,
    gap_y_px,
    sort_order,
    relation_snapshot
  )
  select
    p_document_id,
    r.template_revision_id,
    r.id,
    r.relation_key,
    r.target_kind,
    r.target_group_id,
    r.target_frame_group_ids,
    r.anchor_kind,
    r.anchor_group_id,
    r.anchor_frame_group_id,
    r.anchor_page_corner_id,
    r.gap_y_px,
    r.sort_order,
    r.relation_snapshot
  from templates.template_revision_position_relations r
  where r.template_revision_id = v_target_revision_id
  order by r.sort_order, r.id;

  update documents.document_template_links
  set last_synced_revision_id = v_target_revision_id,
      last_synced_at = timezone('utc'::text, now())
  where document_id = p_document_id;

  update documents.document_registry
  set template_id = v_link.template_id,
      updated_at = timezone('utc'::text, now())
  where id = p_document_id;

  insert into documents.document_template_sync_events (
    document_id,
    template_id,
    from_revision_id,
    to_revision_id,
    sync_reason,
    sync_status,
    debug_payload
  )
  values (
    p_document_id,
    v_link.template_id,
    v_link.last_synced_revision_id,
    v_target_revision_id,
    case when p_reason in ('initial_link', 'template_revision_change', 'manual_resync') then p_reason else 'manual_resync' end,
    'applied',
    jsonb_build_object('sync_mode', v_link.sync_mode, 'auto_sync', v_link.auto_sync)
  );
exception
  when others then
    if v_link.template_id is not null then
      insert into documents.document_template_sync_events (
        document_id,
        template_id,
        from_revision_id,
        to_revision_id,
        sync_reason,
        sync_status,
        debug_payload
      )
      values (
        p_document_id,
        v_link.template_id,
        v_link.last_synced_revision_id,
        v_target_revision_id,
        case when p_reason in ('initial_link', 'template_revision_change', 'manual_resync') then p_reason else 'manual_resync' end,
        'failed',
        jsonb_build_object('error', sqlerrm)
      );
    end if;
    raise;
end;
$$;

create or replace function documents.sync_link_on_insert_or_update()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.auto_sync then
    perform documents.sync_document_template_snapshot(
      new.document_id,
      case when tg_op = 'INSERT' then 'initial_link' else 'manual_resync' end
    );
  end if;

  return new;
end;
$$;

drop trigger if exists sync_link_on_insert_or_update on documents.document_template_links;

create trigger sync_link_on_insert_or_update
after insert or update of template_id, template_revision_id, sync_mode, auto_sync
on documents.document_template_links
for each row
execute function documents.sync_link_on_insert_or_update();

create or replace function documents.sync_documents_after_template_revision_change()
returns trigger
language plpgsql
as $$
declare
  v_document_id uuid;
begin
  if new.current_revision_id is not distinct from old.current_revision_id then
    return new;
  end if;

  for v_document_id in
    select l.document_id
    from documents.document_template_links l
    where l.template_id = new.id
      and l.sync_mode = 'follow_latest'
      and l.auto_sync = true
  loop
    perform documents.sync_document_template_snapshot(v_document_id, 'template_revision_change');
  end loop;

  return new;
end;
$$;

drop trigger if exists sync_documents_after_template_revision_change on templates.template_registry;

create trigger sync_documents_after_template_revision_change
after update of current_revision_id
on templates.template_registry
for each row
execute function documents.sync_documents_after_template_revision_change();

create or replace view documents.document_effective_value_boxes as
select
  f.document_id,
  f.frame_group_id,
  f.label,
  f.role,
  f.box_kind,
  f.runtime_mode,
  f.value_key,
  v.value_payload,
  v.display_text,
  f.page_number,
  f.sort_order
from documents.document_frame_snapshots f
left join documents.document_value_entries v
  on v.document_id = f.document_id
 and v.value_key = f.value_key
where f.role in ('value', 'key_value');

comment on table templates.template_revisions is 'Immutable template revision snapshots used to propagate changes to linked documents';
comment on table templates.template_revision_frames is 'Normalized frame metadata per template revision';
comment on table templates.template_revision_bindings is 'Parent/value bindings between template frames';
comment on table templates.template_revision_position_relations is 'Relative position and spacing relations between template frames';
comment on table documents.document_template_links is 'Template linkage and sync mode for each document';
comment on table documents.document_frame_snapshots is 'Document-local copy of the template frame schema after sync';
comment on table documents.document_frame_bindings is 'Document-local copy of template frame bindings after sync';
comment on table documents.document_position_relations is 'Document-local copy of template position relations after sync';
comment on table documents.document_value_entries is 'Canonical per-document value storage keyed by template value_key';
comment on table documents.document_template_sync_events is 'Audit log for document template sync operations';
comment on view documents.document_effective_value_boxes is 'Value boxes resolved against canonical per-document value entries';

-- 적용 확인용
select
  to_regclass('templates.template_revisions') as template_revisions_table,
  to_regclass('templates.template_revision_frames') as template_revision_frames_table,
  to_regclass('templates.template_revision_bindings') as template_revision_bindings_table,
  to_regclass('templates.template_revision_position_relations') as template_revision_position_relations_table,
  to_regclass('documents.document_template_links') as document_template_links_table,
  to_regclass('documents.document_frame_snapshots') as document_frame_snapshots_table,
  to_regclass('documents.document_frame_bindings') as document_frame_bindings_table,
  to_regclass('documents.document_position_relations') as document_position_relations_table,
  to_regclass('documents.document_value_entries') as document_value_entries_table,
  to_regclass('documents.document_template_sync_events') as document_template_sync_events_table;

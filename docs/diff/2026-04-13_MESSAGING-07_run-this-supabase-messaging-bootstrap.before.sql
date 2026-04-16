create schema if not exists messaging;

create table if not exists messaging.sms_sender_registry (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  display_name text null,
  solapi_status text not null default 'registered'
    check (solapi_status in ('registered', 'unknown')),
  is_active boolean not null default true,
  verified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messaging.sms_recipient_registry (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  recipient_name text null,
  site_id text null,
  memo text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messaging.sms_dispatch_registry (
  id uuid primary key default gen_random_uuid(),
  request_link_id uuid null,
  sender_id uuid null references messaging.sms_sender_registry(id),
  recipient_id uuid null references messaging.sms_recipient_registry(id),
  provider_key text not null default 'solapi'
    check (provider_key in ('solapi')),
  provider_message_id text null,
  status text not null
    check (
      status in (
        'queued',
        'sending',
        'sent',
        'delivered',
        'failed',
        'provider_not_configured',
        'sender_not_registered',
        'recipient_not_registered',
        'manual_required'
      )
    ),
  message_text text not null,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  requested_by text null,
  attempted_at timestamptz null,
  sent_at timestamptz null,
  delivered_at timestamptz null,
  failure_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table messaging.sms_dispatch_registry
  add column if not exists recipient_count integer not null default 0;

alter table messaging.sms_dispatch_registry
  add column if not exists sent_count integer not null default 0;

alter table messaging.sms_dispatch_registry
  add column if not exists failed_count integer not null default 0;

create table if not exists messaging.sms_dispatch_targets (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references messaging.sms_dispatch_registry(id) on delete cascade,
  recipient_id uuid null references messaging.sms_recipient_registry(id),
  recipient_phone_number text not null,
  recipient_name text null,
  provider_message_id text null,
  status text not null
    check (
      status in (
        'queued',
        'sending',
        'sent',
        'delivered',
        'failed',
        'provider_not_configured',
        'sender_not_registered',
        'recipient_not_registered',
        'manual_required'
      )
    ),
  sent_at timestamptz null,
  delivered_at timestamptz null,
  failure_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_sms_dispatch_targets_dispatch_recipient
  on messaging.sms_dispatch_targets (dispatch_id, recipient_id);

create table if not exists messaging.sms_dispatch_events (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references messaging.sms_dispatch_registry(id) on delete cascade,
  event_type text not null
    check (event_type in ('dispatch_requested', 'provider_response', 'dispatch_failed')),
  payload_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists messaging.sms_service_settings (
  id uuid primary key default gen_random_uuid(),
  default_sender_phone_number text null,
  message_prefix text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function messaging.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_sms_sender_updated_at on messaging.sms_sender_registry;
create trigger touch_sms_sender_updated_at
before update on messaging.sms_sender_registry
for each row execute function messaging.touch_updated_at();

drop trigger if exists touch_sms_recipient_updated_at on messaging.sms_recipient_registry;
create trigger touch_sms_recipient_updated_at
before update on messaging.sms_recipient_registry
for each row execute function messaging.touch_updated_at();

drop trigger if exists touch_sms_dispatch_updated_at on messaging.sms_dispatch_registry;
create trigger touch_sms_dispatch_updated_at
before update on messaging.sms_dispatch_registry
for each row execute function messaging.touch_updated_at();

drop trigger if exists touch_sms_dispatch_targets_updated_at on messaging.sms_dispatch_targets;
create trigger touch_sms_dispatch_targets_updated_at
before update on messaging.sms_dispatch_targets
for each row execute function messaging.touch_updated_at();

drop trigger if exists touch_sms_settings_updated_at on messaging.sms_service_settings;
create trigger touch_sms_settings_updated_at
before update on messaging.sms_service_settings
for each row execute function messaging.touch_updated_at();

grant usage on schema messaging to anon, authenticated, service_role;

grant all on all tables in schema messaging to anon, authenticated, service_role;
grant all on all sequences in schema messaging to anon, authenticated, service_role;
grant all on all routines in schema messaging to anon, authenticated, service_role;

alter default privileges for role postgres in schema messaging
grant all on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema messaging
grant all on sequences to anon, authenticated, service_role;

alter default privileges for role postgres in schema messaging
grant all on routines to anon, authenticated, service_role;

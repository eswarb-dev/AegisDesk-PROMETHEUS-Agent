create extension if not exists pgcrypto;

create table if not exists telegram_users (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text unique not null,
  chat_id text,
  username text,
  display_name text,
  role text not null default 'user' check (role in ('owner', 'trusted_contact', 'pending', 'user')),
  contact_id text null,
  memory_enabled boolean not null default true,
  approved boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_seen_at timestamptz
);

create table if not exists memory_items (
  id uuid primary key default gen_random_uuid(),
  owner_telegram_user_id text not null,
  subject_type text not null check (subject_type in ('owner', 'user', 'trusted_contact', 'share_index', 'conversation_summary')),
  subject_key text null,
  memory_type text not null,
  content text not null,
  summary text null,
  visibility text not null check (visibility in ('owner_only', 'trusted_contacts', 'public', 'self_only')),
  allowed_contacts text[] default '{}',
  source text not null,
  confidence numeric default 1.0,
  sensitivity text not null default 'low',
  review_required boolean default false,
  expires_at timestamptz null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists memory_items_subject_unique
on memory_items (subject_type, subject_key);

create table if not exists conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text not null unique,
  role text not null,
  contact_id text null,
  short_summary text not null,
  long_summary text null,
  last_message_at timestamptz,
  message_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists eswar_share_index (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  summary text not null,
  visibility text not null default 'trusted_contacts' check (visibility in ('owner_only', 'trusted_contacts', 'public', 'self_only')),
  allowed_contacts text[] default '{}',
  sensitivity text not null default 'low',
  source text not null default 'owner_approved',
  confidence numeric default 1.0,
  expires_at timestamptz null,
  safe_answer_style text null,
  blocked_details text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  contact_id text unique not null,
  telegram_user_id text unique,
  chat_id text,
  display_name text,
  username text,
  approved boolean default false,
  notification_enabled boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_seen_at timestamptz
);

insert into trusted_contacts (contact_id, display_name, approved, notification_enabled)
values
  ('aksharaa', 'Aksharaa', false, false),
  ('vathanya', 'Vathanya', false, false),
  ('maddhurika', 'Maddhurika', false, false)
on conflict (contact_id) do nothing;

create table if not exists memory_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_telegram_user_id text,
  action text not null,
  target_table text not null,
  target_id text,
  safe_description text,
  created_at timestamptz default now()
);

alter table telegram_users enable row level security;
alter table memory_items enable row level security;
alter table conversation_summaries enable row level security;
alter table eswar_share_index enable row level security;
alter table trusted_contacts enable row level security;
alter table memory_audit_logs enable row level security;

drop policy if exists deny_anonymous_telegram_users on telegram_users;
drop policy if exists deny_anonymous_memory_items on memory_items;
drop policy if exists deny_anonymous_conversation_summaries on conversation_summaries;
drop policy if exists deny_anonymous_eswar_share_index on eswar_share_index;
drop policy if exists deny_anonymous_trusted_contacts on trusted_contacts;
drop policy if exists deny_anonymous_memory_audit_logs on memory_audit_logs;

create policy deny_anonymous_telegram_users on telegram_users for all using (false);
create policy deny_anonymous_memory_items on memory_items for all using (false);
create policy deny_anonymous_conversation_summaries on conversation_summaries for all using (false);
create policy deny_anonymous_eswar_share_index on eswar_share_index for all using (false);
create policy deny_anonymous_trusted_contacts on trusted_contacts for all using (false);
create policy deny_anonymous_memory_audit_logs on memory_audit_logs for all using (false);

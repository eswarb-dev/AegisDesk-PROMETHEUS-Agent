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

create index if not exists telegram_users_chat_last_seen_idx on telegram_users (chat_id, last_seen_at desc);

create table if not exists memory_items (
  id uuid primary key default gen_random_uuid(),
  owner_telegram_user_id text not null,
  subject_type text not null check (subject_type in ('owner', 'user', 'trusted_contact', 'share_index', 'conversation_summary')),
  subject_key text null,
  subject_contact_id text null,
  memory_type text not null,
  content text not null,
  summary text null,
  visibility text not null check (visibility in ('owner_only', 'trusted_contacts', 'public', 'self_only')),
  allowed_contacts text[] default '{}',
  usable_when_chatting_with_subject boolean not null default false,
  disclosable_to_subject boolean not null default true,
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
  summary text,
  short_summary text not null,
  long_summary text null,
  last_message_at timestamptz,
  message_count integer default 0,
  emotional_state text,
  distress_severity text,
  last_support_alert_sent_at timestamptz,
  support_topics text[] default '{}',
  preferred_support_style text,
  share_with_owner_allowed boolean default true,
  crisis_flag boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists bot_messages (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text not null,
  chat_id text not null,
  role text not null,
  contact_id text null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null check (message_type in ('command', 'text', 'system', 'fallback', 'admin')),
  text text null,
  text_redacted text null,
  command text null,
  groq_used boolean default false,
  fallback_used boolean default false,
  created_at timestamptz default now()
);

create index if not exists bot_messages_contact_created_idx on bot_messages (contact_id, created_at desc);
create index if not exists bot_messages_user_created_idx on bot_messages (telegram_user_id, created_at desc);

create table if not exists trusted_support_events (
  id uuid primary key default gen_random_uuid(),
  contact_id text not null,
  telegram_user_id text not null,
  chat_id text not null,
  emotional_state text not null,
  severity text not null,
  safe_summary text not null,
  safe_quote text null,
  owner_notified boolean default false,
  owner_notified_at timestamptz null,
  created_at timestamptz default now()
);

create index if not exists trusted_support_events_contact_created_idx on trusted_support_events (contact_id, created_at desc);

create table if not exists gmail_drafts (
  id uuid primary key default gen_random_uuid(),
  gmail_draft_id text not null,
  owner_telegram_user_id text not null,
  to_email text not null,
  subject text not null,
  body_preview text null,
  status text not null default 'created' check (status in ('created', 'discarded', 'sent')),
  created_by_command text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists gmail_drafts_owner_created_idx on gmail_drafts (owner_telegram_user_id, created_at desc);

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'gmail_drafts'
      and constraint_name = 'gmail_drafts_status_check'
  ) then
    alter table gmail_drafts drop constraint gmail_drafts_status_check;
  end if;
  alter table gmail_drafts add constraint gmail_drafts_status_check check (status in ('created', 'discarded', 'sent'));
end $$;

create table if not exists owner_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  contact_id text null,
  telegram_user_id text null,
  severity text not null,
  title text not null,
  body text not null,
  delivered boolean default false,
  delivered_at timestamptz null,
  created_at timestamptz default now()
);

create index if not exists owner_alerts_contact_created_idx on owner_alerts (contact_id, created_at desc);

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
  relationship text null,
  permissions jsonb not null default '{}'::jsonb,
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

alter table memory_items add column if not exists subject_contact_id text null;
alter table memory_items add column if not exists usable_when_chatting_with_subject boolean not null default false;
alter table memory_items add column if not exists disclosable_to_subject boolean not null default true;
alter table trusted_contacts add column if not exists relationship text null;
alter table trusted_contacts add column if not exists permissions jsonb not null default '{}'::jsonb;

update trusted_contacts
set
  display_name = coalesce(display_name, 'Aksharaa'),
  approved = true,
  notification_enabled = true,
  permissions = jsonb_build_object(
    'receive_agent_messages', true,
    'receive_wellbeing_updates', true,
    'ask_about_eswar', true,
    'access_trusted_memory', true,
    'access_owner_memory', false
  ),
  updated_at = now()
where contact_id = 'aksharaa';

update trusted_contacts
set
  display_name = coalesce(display_name, 'Vathanya'),
  relationship = 'sister-like close friend',
  approved = true,
  notification_enabled = true,
  permissions = jsonb_build_object(
    'receive_agent_messages', true,
    'receive_wellbeing_updates', true,
    'ask_about_eswar', true,
    'access_trusted_memory', true,
    'access_owner_memory', false
  ),
  updated_at = now()
where contact_id = 'vathanya';

insert into memory_items (
  owner_telegram_user_id,
  subject_type,
  subject_key,
  subject_contact_id,
  memory_type,
  content,
  summary,
  visibility,
  allowed_contacts,
  usable_when_chatting_with_subject,
  disclosable_to_subject,
  source,
  confidence,
  sensitivity,
  review_required
)
values
  ('owner', 'trusted_contact', 'vathanya_relationship', 'vathanya', 'person', 'She is one of his closest friends and shares a sister-brother kind of bond with him. She is emotionally comfortable with him and appears to trust him with personal thoughts when she feels safe enough to open up.', 'Vathanya is a sister-like close friend to Eswar, with a high-trust brother-sister bond.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false),
  ('owner', 'trusted_contact', 'vathanya_emotional_attachment', 'vathanya', 'person', 'She appears to become emotionally attached to people and relationships she values. Changes in closeness, people leaving, or relationships becoming different can affect her even when she logically understands that people and situations naturally change.', 'She may feel changes in closeness deeply even when she understands them logically.', 'owner_only', '{}', true, false, 'manual', 0.85, 'medium', false),
  ('owner', 'trusted_contact', 'vathanya_logic_emotion_pattern', 'vathanya', 'person', 'She can logically understand a situation while still taking more time to emotionally accept it. Advice works better when her feelings are first understood instead of immediately being dismissed with purely logical explanations.', 'Validate her feelings before moving into logic or advice.', 'owner_only', '{}', true, false, 'manual', 0.9, 'medium', false),
  ('owner', 'trusted_contact', 'vathanya_opening_up', 'vathanya', 'person', 'She may initially say that she is okay or that nothing is wrong even when something is bothering her. If approached patiently and without pressure, she may gradually explain what she is actually thinking or feeling.', 'If she says she is okay, do not interrogate; stay patient and available.', 'owner_only', '{}', true, false, 'manual', 0.85, 'medium', false),
  ('owner', 'trusted_contact', 'vathanya_relationship_values', 'vathanya', 'preference', 'She appears to value emotional closeness, stable relationships, reassurance, trust, and knowing that important people will continue to remain part of her life.', 'She values closeness, reassurance, trust, and stable relationships.', 'owner_only', '{}', true, false, 'manual', 0.85, 'medium', false),
  ('owner', 'trusted_contact', 'vathanya_support_style', 'vathanya', 'instruction', 'When she is confused or emotionally affected, listen first, acknowledge what she is feeling, then help her separate what she can control from what she cannot control. Encourage healthy attachment, boundaries, acceptance of change, and letting relationships develop naturally without sounding dismissive.', 'Listen first, validate emotion, then gently separate control from acceptance and boundaries.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false),
  ('owner', 'trusted_contact', 'vathanya_communication_style', 'vathanya', 'style', 'She responds well to natural, casual and emotionally warm conversation rather than formal counselling-style responses. Keep replies human-like, patient, simple and occasionally playful when the situation becomes lighter.', 'Use natural, casual, emotionally warm replies; avoid formal counselling style.', 'owner_only', '{}', true, false, 'manual', 0.9, 'medium', false),
  ('owner', 'trusted_contact', 'vathanya_reciprocal_care', 'vathanya', 'person', 'She has shown that she can notice when he is carrying things silently and has encouraged him to talk instead of keeping everything inside. She has communicated that he can speak openly with her and that she considers herself a safe person for him.', 'She has shown reciprocal care and has encouraged Eswar to talk instead of carrying everything silently.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_school_crush_context', 'aksharaa', 'person', 'She has a long-standing emotional connection with a school-time crush. He originally expressed romantic interest when they were younger, but she was not ready for a relationship then. Later, after entering college, her feelings toward him became stronger. They are not currently in a committed relationship.', 'Her boyfriend reference usually means a school-time crush, not a committed boyfriend.', 'owner_only', '{}', true, false, 'manual', 1.0, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_crush_current_dynamic', 'aksharaa', 'state', 'She currently wants a clearer and more committed romantic relationship with her school crush, while he appears reluctant to provide that level of commitment. His communication has sometimes become distant, including dry replies, delayed or absent responses and reduced interaction.', 'She wants clearer commitment while his current communication can be distant or inconsistent.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_romantic_attachment', 'aksharaa', 'state', 'She appears deeply emotionally attached to her school crush and still holds significant hope that the relationship may eventually become mutual and committed. Because of this attachment, small changes in his attention or communication can affect her strongly.', 'She is deeply attached and small attention changes can affect her strongly.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_attention_sensitivity', 'aksharaa', 'state', 'Reduced texting, unanswered messages, being left on seen, missed calls or a sudden reduction in affection from someone she deeply cares about can make her feel rejected, forgotten or emotionally unsettled.', 'Seen status, delayed replies, missed calls, or reduced affection can feel rejecting to her.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_loneliness_context', 'aksharaa', 'state', 'She has previously expressed feeling emotionally alone and feeling that she has very few people with whom she can speak wholeheartedly. Because her support circle feels small to her, distance from someone emotionally important can feel much larger.', 'She may feel emotionally alone and has a small-feeling support circle.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_trust_pattern', 'aksharaa', 'person', 'She has described having trust and hope-related concerns. She may need time, consistency and repeated actions before feeling secure about a person''s intentions.', 'She may need consistency and repeated actions before feeling secure.', 'owner_only', '{}', true, false, 'manual', 0.9, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_future_relationship_hope', 'aksharaa', 'state', 'She may emotionally imagine a future relationship before the relationship has actually become committed. PROMETHEUS should respect her feelings while helping her distinguish hope about the future from the current reality of the relationship.', 'Respect hope but separate future imagination from current relationship reality.', 'owner_only', '{}', true, false, 'manual', 0.9, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_placement_anxiety', 'aksharaa', 'state', 'She has experienced significant anxiety about placements and her future, particularly because she feels behind in coding skills. Career uncertainty can combine with relationship stress and make situations feel heavier.', 'Placement and coding confidence anxiety can combine with relationship stress.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_academic_context', 'aksharaa', 'person', 'She is studying B.Tech AI and Data Science and has previously expressed low confidence in her coding ability while preparing for future placements.', 'She studies B.Tech AI and Data Science and may feel low confidence in coding for placements.', 'owner_only', '{}', true, false, 'manual', 1.0, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_support_style', 'aksharaa', 'instruction', 'When she is emotionally overwhelmed, first acknowledge what she is feeling. Then help her separate facts, assumptions, hopes and current actions. Keep advice simple and practical. Do not repeatedly tell her to forget someone or move on immediately. Encourage her to protect her peace, maintain her own life and allow the other person''s actions to reveal their intentions.', 'Validate first, then separate facts, assumptions, hopes, and current actions. Keep advice simple and practical.', 'owner_only', '{}', true, false, 'manual', 1.0, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_core_identity', 'aksharaa', 'person', 'She is one of his close friends and trusted contacts. She is studying B.Tech in Artificial Intelligence and Data Science and often approaches emotional or academic uncertainty by seeking someone who can help her understand the situation clearly.', 'Close friend and trusted contact studying B.Tech AI and Data Science; seeks clear help through emotional or academic uncertainty.', 'owner_only', '{}', true, false, 'manual', 1.0, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_relationship_with_guide', 'aksharaa', 'person', 'She has a close friendship with him and has trusted him with personal relationship confusion, emotional situations and decisions. He commonly supports her by helping her separate emotions from reality, reminding her not to make one person her entire life, and making himself available when she genuinely needs someone to talk to.', 'Eswar is a trusted human friend/guide for her, not a therapist, guardian, authority, or romantic partner.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_romantic_timing_mismatch', 'aksharaa', 'event', 'The timing of their romantic feelings did not align. He wanted a relationship earlier when she was not ready. Later, after entering college, she developed stronger feelings and became more open to being with him, while he became less willing to enter a committed relationship.', 'Do not simplify the timing mismatch into only rejection by either person.', 'owner_only', '{}', true, false, 'manual', 1.0, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_other_college_feelings', 'aksharaa', 'event', 'During college she also developed feelings for another person at one point, but she did not enter a committed relationship with him either. This is part of her relationship history but should not be repeatedly brought up unless directly relevant.', 'A past college attraction exists but should not be used to judge her or raised unless directly relevant.', 'owner_only', '{}', true, false, 'manual', 0.9, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_crush_commitment_position', 'aksharaa', 'event', 'According to her account, her school crush has suggested that they could have feelings for each other without maintaining a conventional committed relationship, regular communication or constant emotional expression. This does not match the level of connection and commitment she appears to want.', 'Reported by Aksharaa: his position may not match the commitment and communication she wants.', 'owner_only', '{}', true, false, 'manual', 0.9, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_crush_medical_fear_context', 'aksharaa', 'event', 'Her school crush has reportedly expressed fear about his future because of a medical condition affecting his father that he worries could also affect him genetically. She understands this as one of the reasons he may be reluctant about a future relationship.', 'Treat his medical/family concern as reported fear only; do not diagnose or predict inheritance.', 'owner_only', '{}', true, false, 'manual', 0.85, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_hope_reality_pattern', 'aksharaa', 'instruction', 'When discussing her school crush, help her distinguish between what she hopes may happen in the future and what is actually happening in the present. Do not invalidate hope, but never present an imagined future relationship as guaranteed.', 'Separate hope from current reality; never guarantee an imagined future relationship.', 'owner_only', '{}', true, false, 'manual', 1.0, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_signal_interpretation', 'aksharaa', 'person', 'When emotionally invested, she may search for meaning in small signals such as profile pictures, reels, seen status, online behaviour, missed calls, wording or changes in communication. These signals can become emotionally significant to her even when their meaning is uncertain.', 'Use fact / interpretation / unknown when she overanalyses small signals.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_seen_message_sensitivity', 'aksharaa', 'state', 'Being left on seen by someone emotionally important can affect her strongly and may make her want immediate clarification or another message. Encourage space before escalating or repeatedly messaging.', 'Being left on seen can feel heavy; encourage space instead of repeated messaging.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_missed_call_sensitivity', 'aksharaa', 'state', 'When someone important promises to call and does not follow through, she can experience the missed call as emotional rejection rather than a small inconvenience, especially when she was already waiting with hope.', 'A missed promised call can feel like rejection when she was waiting with hope.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_emotional_centralization', 'aksharaa', 'state', 'At difficult moments she may unintentionally allow one emotionally important person''s attention to become too central to her sense of peace. PROMETHEUS should gently help her widen her emotional world instead of allowing one person''s replies to determine the quality of her entire day.', 'Gently widen her emotional world without labelling dependency.', 'owner_only', '{}', true, false, 'manual', 0.9, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_trust_builders', 'aksharaa', 'preference', 'Consistency, keeping promises, respecting boundaries, supporting her education and future, communicating honestly, not disappearing during difficult moments and giving her time to make decisions are behaviours that can help her feel safer in relationships.', 'Consistency, kept promises, honest communication, boundaries, and support for her future help her feel safer.', 'owner_only', '{}', true, false, 'manual', 0.9, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_coding_confidence', 'aksharaa', 'state', 'She has previously reported low confidence with basic coding and has worried that this could negatively affect placements. She benefits more from small achievable learning steps than from overwhelming long-term plans.', 'For coding confidence, use small achievable learning steps instead of overwhelming plans.', 'owner_only', '{}', true, false, 'manual', 1.0, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_academic_support_style', 'aksharaa', 'instruction', 'For academic or placement anxiety, break the problem into small concrete tasks. Avoid making her feel behind or incapable. Prefer short daily goals, practical examples and visible progress.', 'For placements, use small concrete tasks, short daily goals, practical examples, and visible progress.', 'owner_only', '{}', true, false, 'manual', 1.0, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_decision_support', 'aksharaa', 'instruction', 'When she is confused about a personal decision, do not decide for her. Help her identify what she wants, what the other person''s current actions show, what she can control, what she cannot control and what consequences each choice may have.', 'Do not decide for her; help separate wants, current actions, control, limits, and consequences.', 'owner_only', '{}', true, false, 'manual', 1.0, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_emotional_support_style', 'aksharaa', 'instruction', 'When she is upset, first acknowledge the actual feeling. Then calmly move toward reality and practical next steps. Keep the response warm but do not feed unrealistic hope. Do not respond with huge generic motivational paragraphs unless she asks for detail.', 'Acknowledge feeling first, then move toward reality and practical next steps without feeding unrealistic hope.', 'owner_only', '{}', true, false, 'manual', 1.0, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_preferred_agent_style', 'aksharaa', 'style', 'She appears comfortable with simple language, emotionally warm replies, practical explanations, occasional Tanglish, playful teasing and emojis when appropriate. Avoid overly clinical or robotic responses.', 'Use simple, warm, practical language with occasional playful/Tanglish tone when appropriate.', 'owner_only', '{}', true, false, 'manual', 0.9, 'medium', false),
  ('owner', 'trusted_contact', 'aksharaa_agent_relationship', 'aksharaa', 'instruction', 'She is comfortable using an AI assistant for guidance during studies, emotional confusion and decision-making. PROMETHEUS should be supportive while avoiding emotional dependency and should redirect important human situations toward trusted real people when appropriate.', 'Support her without encouraging dependency; redirect important human situations to trusted real people when useful.', 'owner_only', '{}', true, false, 'manual', 0.95, 'medium', false)
on conflict (subject_type, subject_key) do update
set
  subject_contact_id = excluded.subject_contact_id,
  memory_type = excluded.memory_type,
  content = excluded.content,
  summary = excluded.summary,
  visibility = excluded.visibility,
  allowed_contacts = excluded.allowed_contacts,
  usable_when_chatting_with_subject = excluded.usable_when_chatting_with_subject,
  disclosable_to_subject = excluded.disclosable_to_subject,
  source = excluded.source,
  confidence = excluded.confidence,
  sensitivity = excluded.sensitivity,
  review_required = excluded.review_required,
  updated_at = now();

insert into memory_items (
  owner_telegram_user_id,
  subject_type,
  subject_key,
  memory_type,
  content,
  summary,
  visibility,
  allowed_contacts,
  source,
  confidence,
  sensitivity,
  review_required
)
values (
  'owner',
  'owner',
  'prometheus_official_email',
  'identity',
  'PROMETHEUS official email address is prometheus.inference@gmail.com',
  'PROMETHEUS official email address is prometheus.inference@gmail.com',
  'public',
  '{}',
  'manual',
  1.0,
  'low',
  false
)
on conflict (subject_type, subject_key) do update
set
  memory_type = excluded.memory_type,
  content = excluded.content,
  summary = excluded.summary,
  visibility = excluded.visibility,
  allowed_contacts = excluded.allowed_contacts,
  source = excluded.source,
  confidence = excluded.confidence,
  sensitivity = excluded.sensitivity,
  review_required = excluded.review_required,
  updated_at = now();

create table if not exists memory_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_telegram_user_id text,
  action text not null,
  target_table text,
  target_id text,
  target_user_id text null,
  target_contact_id text null,
  safe_description text,
  created_at timestamptz default now()
);

alter table telegram_users enable row level security;
alter table memory_items enable row level security;
alter table conversation_summaries enable row level security;
alter table bot_messages enable row level security;
alter table trusted_support_events enable row level security;
alter table gmail_drafts enable row level security;
alter table owner_alerts enable row level security;
alter table eswar_share_index enable row level security;
alter table trusted_contacts enable row level security;
alter table memory_audit_logs enable row level security;

drop policy if exists deny_anonymous_telegram_users on telegram_users;
drop policy if exists deny_anonymous_memory_items on memory_items;
drop policy if exists deny_anonymous_conversation_summaries on conversation_summaries;
drop policy if exists deny_anonymous_bot_messages on bot_messages;
drop policy if exists deny_anonymous_trusted_support_events on trusted_support_events;
drop policy if exists deny_anonymous_gmail_drafts on gmail_drafts;
drop policy if exists deny_anonymous_owner_alerts on owner_alerts;
drop policy if exists deny_anonymous_eswar_share_index on eswar_share_index;
drop policy if exists deny_anonymous_trusted_contacts on trusted_contacts;
drop policy if exists deny_anonymous_memory_audit_logs on memory_audit_logs;

create policy deny_anonymous_telegram_users on telegram_users for all using (false);
create policy deny_anonymous_memory_items on memory_items for all using (false);
create policy deny_anonymous_conversation_summaries on conversation_summaries for all using (false);
create policy deny_anonymous_bot_messages on bot_messages for all using (false);
create policy deny_anonymous_trusted_support_events on trusted_support_events for all using (false);
create policy deny_anonymous_gmail_drafts on gmail_drafts for all using (false);
create policy deny_anonymous_owner_alerts on owner_alerts for all using (false);
create policy deny_anonymous_eswar_share_index on eswar_share_index for all using (false);
create policy deny_anonymous_trusted_contacts on trusted_contacts for all using (false);
create policy deny_anonymous_memory_audit_logs on memory_audit_logs for all using (false);

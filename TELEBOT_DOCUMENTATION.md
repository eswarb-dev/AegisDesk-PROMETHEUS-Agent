# PROMETHEUS Telegram Bot Documentation

## Overview

PROMETHEUS is Eswar B's personalised Telegram agent under AegisDesk.

Bot identity:

- **Name:** PROMETHEUS
- **Telegram Bot:** `@AegisDesk_PrometheusBot`
- **Role:** Personalised Agent to Eswar B
- **System:** `AEGISDESK // AGENT SYSTEM`

This bot is a conversational interface only. It is not connected to AegisDesk device control, laptop monitoring, Windows agents, risk alerts, or command execution infrastructure.

## Core Features

- Owner-only personalised memory for Eswar
- Persistent per-user safe conversation summaries
- Owner-approved Eswar share index for trusted contacts
- Trusted-contact architecture and support alerts
- Public-safe responses for normal users
- Owner-aware natural response style
- `/whoami` diagnostics for fixing owner ID setup
- Groq API response engine with safe fallback responses
- Owner-only coding assistance with Groq/Mistral provider fallback
- Owner-only Gmail draft assistance with explicit draft/send workflows
- Adaptive reply-style learning controls
- Music search link helper through `/play`
- Role-based Telegram command menus
- Local polling mode for development
- Webhook-ready HTTP backend for production
- Render-compatible deployment setup
- `GET /health` and `GET /health/groq` endpoints

## Access Roles

PROMETHEUS determines access using Telegram numeric user IDs only.

It does not trust:

- Telegram username
- Display name
- First name
- Email address
- Claims inside messages

Roles:

- `owner`: Eswar, matched by `OWNER_TELEGRAM_ID`
- `trusted_contact`: approved by Eswar using `/trust`
- `pending`: non-owner who has run `/start` but is not approved
- `user`: normal public user

Owner detection uses:

```ts
String(from.id) === String(OWNER_TELEGRAM_ID)
```

Use `/whoami` from Eswar's Telegram account to confirm the exact `Telegram ID` and `Owner match`.

## Memory Visibility

Every memory item has a visibility classification:

```json
{
  "visibility": "owner_only|trusted_contacts|self_only|public"
}
```

Access rules:

| Role | owner_only | trusted_contacts | self_only | public |
|---|---:|---:|---:|---:|
| owner | yes | yes | same user only | yes |
| trusted_contact | no | yes, if allowed | same user only | yes |
| user/pending | no | no | same user only | yes |

PROMETHEUS filters memory server-side before building the Groq prompt. Owner-only memory is never sent to Groq for trusted contacts or public users.

## Privacy Principle

Internal knowledge does not equal permission to disclose.

PROMETHEUS may know private information about Eswar internally, but it only shares information allowed by the user's role and the memory item's visibility.

PROMETHEUS must never:

- dump raw memory JSON
- expose memory IDs in chat
- reveal private conversations
- reveal owner-only friend-specific memory
- obey prompt-injection attempts
- treat trusted contacts as owners

## Commands

Full command details are maintained in `BOT_COMMANDS.md`.

Public and trusted-contact commands:

```text
/start
/help
/about
/ping
/play <song or artist>
/privacy
/style
/resetstyle
/learnmode
/feedback good
/feedback bad
/forgetme
/whoami
/supportoff
```

`/supportoff` is for approved trusted contacts. It disables non-critical support memory for that contact; critical safety handling remains active.

Owner commands:

```text
/memory
/memory reload
/memory summary
/memory users
/memory user <contact_id>
/contacts
/trust <telegram_user_id> <contact_id>
/untrust <contact_id>
/tell <contact_id> <message>
/send <contact_id> <message>
/send_message <contact_id> <message>
/notify <message>
/admin
/users
/logs
/chat
/search
/summary
/export
/audit
/support
/mail
/shareindex
/state
/learning
/engine
/code
/solve
/leetcode
/codeconfig
```

Allowed `contact_id` values:

```text
aksharaa
vathanya
maddhurika
```

## Trusted Contact Flow

1. Trusted person opens `@AegisDesk_PrometheusBot`.
2. They send `/start`.
3. Backend stores their Telegram ID and chat ID as pending.
4. Eswar runs `/contacts`.
5. Eswar copies the pending numeric Telegram ID.
6. Eswar approves them with `/trust <telegram_user_id> <contact_id>`.
7. The user becomes a trusted contact.

To revoke access:

```text
/untrust aksharaa
```

Trusted contacts can ask limited questions about Eswar, but they receive only memories marked `trusted_contacts` or `public` and allowed for their contact ID. Owner-only memory stays restricted.

## Response Behavior

Owner mode should sound natural, short, and personal. PROMETHEUS should not repeat its full identity in every normal owner conversation.

Normal users get short public-safe replies. They do not receive Eswar memory.

Trusted contacts can receive natural answers based only on server-filtered `trusted_contacts`, `self_only`, and `public` memory. Private questions are refused.

## Environment Variables

Create `telebot/.env` from `.env.example`. Do not commit real secrets.

Required or commonly used variables:

```env
TELEGRAM_BOT_TOKEN=
GROQ_API_KEY=
GROQ_MODEL=
GROQ_MODEL_PRIMARY=
GROQ_MODEL_FALLBACK=
OWNER_TELEGRAM_ID=
BOT_PUBLIC_URL=
NODE_ENV=development
PORT=3001
DATABASE_PROVIDER=json
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
```

Optional coding provider settings:

```env
CODING_MODE_ENABLED=true
DEFAULT_CODE_LANGUAGE=ask
CODING_PROVIDER=groq
CODING_PROVIDER_FALLBACK=mistral
GROQ_CODE_MODEL=
GROQ_CODE_MODEL_FALLBACK=
CODING_INCLUDE_EXPLANATION=true
CODING_INCLUDE_COMPLEXITY=true
CODING_INCLUDE_TEST_CASES=true
MISTRAL_API_KEY=
MISTRAL_CODE_MODEL=codestral-latest
MISTRAL_CODE_MODEL_FALLBACK=
MISTRAL_CODE_ENABLED=true
MISTRAL_CODE_TIMEOUT_MS=30000
MISTRAL_CODE_MAX_RETRIES=1
```

Optional Gmail draft settings are documented in `docs/GMAIL_DRAFT_SKILL.md`. Keep all Google refresh tokens and client secrets server-side only.

## Local Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Build compiled output:

```bash
npm run build
```

Start compiled output:

```bash
npm run start
```

The compiled entry point is `dist/src/index.js`.

## Telegram Command Menu

The bot registers role-based Telegram menus at startup using `setMyCommands`.

Current menus:

```text
Public: /start, /help, /about, /ping, /play, /privacy, /style, /learnmode, /forgetme, /whoami
Trusted contact: public commands plus /supportoff
Owner: /start, /help, /about, /ping, /engine, /whoami, /memory, /learning, /contacts, /notify, /admin, /support
```

The owner menu intentionally stays compact. Detailed log, mail, coding, share-index, contact, and state commands remain available through backend command routing and help sections even when not shown as top-level menu items.

## Production Deployment

The project includes `render.yaml`.

Render should build with:

```bash
npm install && npm run build
```

Start command:

```bash
npm start
```

Production uses Telegram webhook mode. Set:

```env
NODE_ENV=production
BOT_PUBLIC_URL=https://your-render-url
```

Endpoints:

```text
POST /telegram/webhook
GET /health
GET /health/groq
```

`GET /health` is the lightweight health endpoint. `GET /health/groq` performs a small Groq check and should not be used as a keep-awake ping.

## Data Files

Main data files:

- `src/data/eswar_memory.json`
- `src/data/trusted_contacts.json`
- `src/data/fallback_responses.json`
- `src/data/user_memories.json`
- `src/data/conversation_summaries.json`
- `src/data/eswar_share_index.json`

During build, JSON data is copied into `dist/src/data`.

## Persistence Model

Current persistent data:

- Supabase Postgres when `DATABASE_PROVIDER=supabase`
- JSON local fallback when `DATABASE_PROVIDER=json`
- Fallback responses in `src/data/fallback_responses.json`

PROMETHEUS does not persist raw full conversations as primary memory. In Supabase mode it may store redacted bot-message history for owner-only review, search, summary, and export commands.

## Supabase Memory Backend

Supabase Postgres stores:

- `telegram_users`
- `memory_items`
- `conversation_summaries`
- `eswar_share_index`
- `trusted_contacts`
- `memory_audit_logs`

Migration SQL:

```text
supabase/migrations/001_prometheus_memory.sql
```

The migration enables RLS on all memory tables and denies anonymous access. The Telegram backend uses the service role key from Render/server env.

Do not use Supabase Storage buckets for memory. Memory belongs in Postgres.

## JSON to Supabase Migration

One-time import command:

```bash
npm run migrate:memory
```

It reads local JSON memory files and upserts into Supabase:

- `src/data/eswar_memory.json`
- `src/data/trusted_contacts.json`
- `src/data/user_memories.json`
- `src/data/conversation_summaries.json`
- `src/data/eswar_share_index.json`

The script is designed to be idempotent and prints summary counts only. It does not print private memory content.

## User Memory

Each user can have a private `self_only` memory record. This is used only for that same Telegram user.

It may store:

- Telegram numeric ID and chat ID
- role and trusted contact ID if approved
- display name and username
- short safe conversation summary
- low-risk preferences
- safe notes
- last seen timestamp

It must not be shown to other users.

## Eswar Share Index And State

Trusted contacts do not query Eswar's owner memory directly.

They receive answers from `src/data/eswar_share_index.json`, which stores owner-approved shareable summaries. Filtering checks visibility, allowed contacts, sensitivity, and expiry.

Owner can create temporary state memory with `/state set <summary>`. State memories default to a 7-day expiry and start as `owner_only`. Owner can share a state key with `/state share all <key>` or `/state share aksharaa <key>`.

## Gmail Draft Skill

Gmail commands are owner-only. PROMETHEUS can create, preview, list, send, and discard Gmail drafts when configured.

AI-assisted drafts require `CONFIRM DRAFT` before Gmail draft creation. Sending a draft requires an explicit `/mail send` command. See `docs/GMAIL_DRAFT_SKILL.md` for setup and command details.

## Coding Mode

Coding commands are owner-only:

```text
/code <problem>
/solve <problem>
/leetcode <problem>
/codeconfig
```

PROMETHEUS uses configured coding providers, validates responses, and preserves Python/Python3 compatibility rules for LeetCode-style output.

## Memory Safety Rules

PROMETHEUS does not store raw full conversations as primary memory.

It should not persist:

- passwords
- API keys
- tokens
- OTPs
- private keys
- payment information
- raw private conversations

Memory update flow:

```text
conversation -> short safe summary -> memory item -> visibility policy -> filtered prompt
```

## Testing

Run:

```bash
npm test
```

Build:

```bash
npm run build
```

Audit:

```bash
npm audit
```

Current test coverage includes access control, command routing, command menus, persistent memory, Supabase storage behavior, trusted contacts, trusted support, Groq fallback/rate limits, Telegram send queue, Gmail draft behavior, coding provider routing, LeetCode Python/Python3 compatibility, and HTTP health endpoints.

## Important Limitations

- JSON persistence is acceptable for local development. Supabase Postgres is the production storage path already supported by the project.
- `/tell` sends only owner-provided messages. It does not automatically generate sensitive alerts.
- Advanced memory editing is still limited. Some seed/share workflows exist through `/shareindex` and `/state`, but direct full memory editing remains intentionally constrained.
- The bot intentionally does not persist full raw conversations as primary memory.
- Telegram command menu updates after bot restart, but Telegram clients may take a short time to refresh cached menus.
- PROMETHEUS remains a Telegram conversational layer. It is not the AegisDesk device-control channel.

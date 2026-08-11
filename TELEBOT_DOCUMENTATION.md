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
- Trusted-contact architecture
- Public-safe responses for normal users
- Owner-aware natural response style
- `/whoami` diagnostics for fixing owner ID setup
- Rotating trusted-contact suggestion prompts
- Groq API response engine
- JSON fallback responses when Groq is unavailable
- Telegram command routing
- Local polling mode for development
- Webhook-ready HTTP backend for production
- Render-compatible deployment setup
- `GET /health` endpoint

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
  "visibility": "owner_only|trusted_contacts|public"
}
```

Access rules:

| Role | owner_only | trusted_contacts | public |
|---|---:|---:|---:|
| owner | yes | yes | yes |
| trusted_contact | no | yes | yes |
| user/pending | no | no | yes |

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

### Public Commands

```text
/start
/help
/about
/ping
/whoami
```

### Owner Commands

```text
/memory
/contacts
/trust <telegram_user_id> <contact_id>
/untrust <contact_id>
/tell <contact_id> <message>
```

Allowed `contact_id` values:

```text
aksharaa
vathanya
maddhurika
```

Use lowercase contact IDs.

Example:

```text
/trust 5559225697 vathanya
```

## Trusted Contact Flow

1. Trusted person opens `@AegisDesk_PrometheusBot`.
2. They send:

```text
/start
```

3. Backend stores their Telegram ID and chat ID as pending.
4. Eswar runs:

```text
/contacts
```

5. Eswar copies the pending numeric Telegram ID.
6. Eswar approves them:

```text
/trust <telegram_user_id> aksharaa
```

7. The user becomes a trusted contact.

To revoke:

```text
/untrust aksharaa
```

## Trusted Contacts

Initial trusted-contact slots:

- Aksharaa
- Vathanya
- Maddhurika

Their Telegram IDs are not hardcoded. They are captured only after each person runs `/start`, then approved by Eswar.

Trusted contacts can ask limited questions about Eswar, but they receive only memories marked `trusted_contacts` or `public`.

If a trusted contact casually mentions Eswar, PROMETHEUS returns a rotating set of generic safe suggestions. These suggestions avoid mental-health-leading prompts and do not reveal memory.

Example:

```text
You can ask me about Eswar, but only within what he has allowed me to share 😌

Try:
- What is Eswar generally like?
- What kind of conversations does he prefer?
- How does he usually approach problems?
- What should I keep in mind when talking to him?
- What can you share without crossing privacy?

Private conversations and owner-only memory stay restricted.
```

The exact questions rotate across several generic safe sets.

## Response Behavior

### Owner Mode

When Eswar is detected as owner, PROMETHEUS should sound natural, short, and personal.

Examples:

```text
User: Hii
PROMETHEUS: Hii Eswar 😌
PROMETHEUS online.
```

```text
User: Is this Eswar bro?
PROMETHEUS: Yeah bro, it's you 😄
Owner mode active.
```

PROMETHEUS should not repeat its full identity in every normal owner conversation.

### Non-Owner Mode

Normal users get short public-safe replies. They do not receive Eswar memory.

Example:

```text
PROMETHEUS is active. Personalised memory is owner-restricted.
```

If a non-owner asks whether the bot is Eswar:

```text
No.
I'm PROMETHEUS, a personalised agent. Owner mode is restricted.
```

### Trusted Contact Mode

Trusted contacts can receive natural answers based only on server-filtered `trusted_contacts` and `public` memories.

Private questions are refused:

```text
I know more than I'm allowed to share 😌
That part stays between Eswar and me.
```

## Environment Variables

Create `telebot/.env` from `.env.example`.

Required:

```env
TELEGRAM_BOT_TOKEN=
GROQ_API_KEY=
GROQ_MODEL=
OWNER_TELEGRAM_ID=
NODE_ENV=development
PORT=3001
```

Required for production webhook mode:

```env
BOT_PUBLIC_URL=
```

Never commit `.env`.

## Local Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Health check:

```text
http://localhost:3001/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "prometheus-telegram-chatbot"
}
```

## Telegram Command Menu

The bot registers its Telegram menu at startup using `setMyCommands`.

Restart the bot after command changes:

```bash
npm run dev
```

Current menu:

```text
/start
/help
/about
/ping
/memory
/whoami
/contacts
/trust
/untrust
/tell
/privacy
/forgetme
/shareindex
/state
```

## Production Deployment

The project includes `render.yaml`.

Render should use:

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

Webhook endpoint:

```text
POST /telegram/webhook
```

Health endpoint:

```text
GET /health
```

## Data Files

Main data files:

- `src/data/eswar_memory.json`
- `src/data/trusted_contacts.json`
- `src/data/fallback_responses.json`

During build, JSON data is copied into `dist/src/data`.

## Persistence Model

Current persistent data:

- Eswar's structured memory in `src/data/eswar_memory.json`
- Trusted-contact mappings and pending users in `src/data/trusted_contacts.json`
- Per-user safe summaries in `src/data/user_memories.json`
- Conversation summary scaffold in `src/data/conversation_summaries.json`
- Owner-approved Eswar share index in `src/data/eswar_share_index.json`
- Memory policy config in `src/data/memory_policies.json`
- Fallback responses in `src/data/fallback_responses.json`

Current non-persistent data:

- Raw full conversations
- Private temporary session context
- API request logs

PROMETHEUS stores short, safe, structured summaries instead of raw full conversations.

## Persistent Per-User Memory

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

## User Memory Format

Stored in `src/data/user_memories.json`:

```json
{
  "telegram_user_id": "123456789",
  "chat_id": "123456789",
  "role": "trusted_contact|pending|user",
  "contact_id": "aksharaa|null",
  "display_name": "...",
  "username": "...",
  "memory_enabled": true,
  "conversation_summary": "...",
  "preferences": [],
  "important_context": [],
  "safe_notes": []
}
```

Persistent per-user memory items use `visibility: "self_only"`.

## Eswar Share Index

Trusted contacts do not query Eswar's owner memory directly.

They receive answers from `src/data/eswar_share_index.json`, which stores owner-approved shareable summaries.

Filtering checks:

- visibility
- allowed contacts
- sensitivity
- expiry

Expired share-index items are ignored.

## Trusted Contact Question Handling

Trusted-contact question flow:

1. Resolve Telegram numeric ID.
2. Resolve trusted contact ID.
3. Refuse private or prompt-injection questions.
4. Load only that user's own memory.
5. Load only allowed Eswar share indexes.
6. Build Groq context from filtered memory only.
7. Answer naturally.

Owner-only memory is never sent to Groq for trusted contacts.

## Owner State Memory

Owner can create temporary state memory:

```text
/state set <summary>
```

State memories default to a 7-day expiry and start as `owner_only`.

Owner can share a state key:

```text
/state share all <key>
/state share aksharaa <key>
```

Shared state becomes `trusted_contacts` visibility and is filtered by allowed contact.

## /forgetme and /privacy

Users can inspect memory behavior:

```text
/privacy
```

Users can delete their stored user memory:

```text
/forgetme
```

This deletes user-specific PROMETHEUS memory. Trusted-contact approval metadata is still managed separately by owner commands.

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

## Fallback Responses

Fallback responses are split by audience:

- `owner_api_error`
- `owner_unknown`
- `non_owner`

Owner fallback keeps the PROMETHEUS style:

```text
Thinking engine is down for a moment, bro. Basic mode is still active.
```

Non-owner fallback remains restricted:

```text
Public-safe mode only. Owner memory is restricted.
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

Current test coverage includes:

- owner memory access
- trusted-contact memory access
- public-user restrictions
- trusted-contact persistence
- username spoofing protection
- command permission checks
- Groq context filtering
- prompt-injection refusal
- fallback loading
- health endpoint
- `/whoami` Telegram ID output
- owner string/number ID comparison
- owner direct replies
- rotating trusted-contact suggestions
- per-user memory creation
- safe summary updates
- `/forgetme`
- share-index allowed-contact filtering
- expired share-index filtering
- owner state memory creation and sharing

## Important Limitations

- JSON persistence is acceptable for local development, but production should eventually move trusted-contact and memory data to PostgreSQL, Supabase, or SQLite.
- `/tell` sends only owner-provided messages. It does not automatically generate sensitive alerts.
- The bot does not currently implement advanced memory editing commands. Memory is manually edited in `eswar_memory.json`.
- The bot intentionally does not persist full raw conversations. It stores short safe summaries only.
- Telegram command menu updates after bot restart, but Telegram clients may take a short time to refresh cached menus.

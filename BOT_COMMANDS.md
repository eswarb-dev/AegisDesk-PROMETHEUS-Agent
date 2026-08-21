# PROMETHEUS Bot Commands

Scope note: PROMETHEUS can only store, summarize, search, and export conversations that happen inside `@AegisDesk_PrometheusBot`.

## Role-Based Telegram Menus

Telegram command menus are scoped by role to reduce clutter. Menu visibility is only a UI convenience; server-side role checks remain mandatory for every restricted command.

### Public Menu

- `/start`
- `/help`
- `/about`
- `/ping`
- `/engine`
- `/play`
- `/privacy`
- `/forgetme`
- `/whoami`

### Trusted Contact Menu

- `/start`
- `/help`
- `/about`
- `/ping`
- `/play`
- `/privacy`
- `/forgetme`
- `/whoami`
- `/supportoff`

### Owner Menu

- `/start`
- `/help`
- `/about`
- `/ping`
- `/play`
- `/whoami`
- `/memory`
- `/contacts`
- `/mail`
- `/notify`
- `/admin`
- `/support`

The owner menu intentionally stays compact. Detailed log commands are shown through `/admin` or `/help logs`.

### Admin Help Sections

- `/admin` shows owner admin groups.
- `/help owner` shows owner memory commands.
- `/help logs` shows owner log commands.
- `/help contacts` shows trusted-contact management commands.
- `/help support` shows trusted support commands.
- `/help trusted` shows trusted-contact commands.

Access control reminder: hiding a command from the Telegram menu does not grant or remove access. PROMETHEUS still checks the sender role on the backend.

## General Commands

| Command | Access | Description |
| --- | --- | --- |
| `/start` | All users | Starts PROMETHEUS, registers the Telegram user, and shows the privacy/role-specific intro. |
| `/help` | All users | Shows the basic command help. |
| `/about` | All users | Shows PROMETHEUS identity and capability boundaries. |
| `/ping` | All users | Checks whether the bot is online and returns latency. |
| `/play <song or artist>` | All users | Returns playable YouTube Music and Spotify search links. PROMETHEUS does not claim direct playback without a real music/device integration. |
| `/privacy` | All users | Explains memory, bot-log storage, owner review scope, and trusted-contact support alerts. |
| `/forgetme` | Non-owner users, with confirmation | Deletes stored PROMETHEUS memory, conversation summary, and bot-message history for that user after `CONFIRM FORGETME`. |
| `/whoami` | All users | Shows Telegram ID, chat ID, role, and owner-match status. |
| `/help trusted` | Trusted contacts and owner | Shows trusted-contact available commands. |

## Owner Memory And Admin Commands

| Command | Access | Description |
| --- | --- | --- |
| `/memory` | Owner only | Shows owner memory status. |
| `/memory reload` | Owner only | Reloads memory from storage. |
| `/memory summary` | Owner only | Shows storage summary counts for memories, users, trusted contacts, and share indexes. |
| `/memory users` | Owner only | Lists stored user-memory records in JSON storage mode. |
| `/memory user <contact_id>` | Owner only | Shows memory/conversation summary for a trusted contact, such as `aksharaa`. |
| `/shareindex` | Owner only | Manages or views approved share-index memory. |
| `/state` | Owner only | Shows runtime/config state relevant to PROMETHEUS. |
| `/engine` | Owner only | Shows Render, Groq, memory, fallback, and last Groq success/failure status without exposing secrets. |
| `/help owner` | Owner only | Shows owner memory commands. |

## Render And Engine Health

| Endpoint / Setting | Access | Description |
| --- | --- | --- |
| `GET /health` | Public HTTP health check | Lightweight Render health endpoint. It reports uptime, timestamp, memory status, and cached Groq state without calling Groq. |
| `GET /health/groq` | Operational check | Performs a tiny Groq `reply ok` check and returns safe status/error type only. Do not schedule this as a keep-awake ping. |
| `PROMETHEUS_RENDER_HEALTH_URL` | GitHub Actions secret | Set this to `https://<render-service>.onrender.com/health` for the keep-awake workflow. |

## Trusted Contact Management

| Command | Access | Description |
| --- | --- | --- |
| `/contacts` | Owner only | Lists trusted contacts and pending users. |
| `/trust <telegram_user_id> <contact_id>` | Owner only | Approves a pending user as a trusted contact. Allowed contacts: `aksharaa`, `vathanya`, `maddhurika`. |
| `/untrust <contact_id>` | Owner only | Revokes a trusted contact link. |
| `/tell <contact_id> <message>` | Owner only | Sends a direct bot message to an approved trusted contact. |
| `/notify <message>` | Owner only | Broadcasts an owner-written message to all stored bot users with known chat IDs, using the Telegram send queue. |
| `/help contacts` | Owner only | Shows trusted-contact management commands. |

## Admin Log Commands

| Command | Access | Description |
| --- | --- | --- |
| `/users` | Owner only | Lists users who have interacted with PROMETHEUS. |
| `/logs` | Owner only | Shows recent bot activity across users. |
| `/logs <contact_id>` | Owner only | Shows recent bot logs for a trusted contact. |
| `/chat <contact_id>` | Owner only | Shows the latest bot conversation with a trusted contact. |
| `/chat <contact_id> <limit>` | Owner only | Shows the latest N bot messages for a trusted contact. |
| `/search <contact_id> <query>` | Owner only | Searches a trusted contact's PROMETHEUS bot conversation. |
| `/summary <contact_id>` | Owner only | Shows stored conversation summary for a trusted contact. |
| `/export <contact_id>` | Owner only | Sends a `.txt` export document for that contact's bot conversation. |
| `/audit` | Owner only | Shows recent owner admin access actions. |
| `/admin` | Owner only | Shows grouped owner admin/log, memory, contact, and support command lists. |
| `/help logs` | Owner only | Shows owner log commands. |

## Trusted Support Commands

| Command | Access | Description |
| --- | --- | --- |
| `/support` | Owner only | Shows recent trusted-support events. |
| `/support <contact_id>` | Owner only | Shows recent trusted-support summaries for one contact. |
| `/support alerts` | Owner only | Shows owner support alerts that were created/sent. |
| `/support settings` | Owner only | Shows support-alert limits and scope rules. |
| `/supportoff` | Approved trusted contacts only | Disables non-critical support memory for that contact. Critical safety handling remains active. |
| `/help support` | Owner only | Shows owner support commands. |

## Mail Draft Commands

| Command | Access | Description |
| --- | --- | --- |
| `/mail` | Owner only | Shows PROMETHEUS Mail Draft Skill help. |
| `/mail status` | Owner only | Shows Gmail draft env/config presence without exposing secrets. |
| `/mail diagnose` | Owner only | Checks whether Google accepts the configured Gmail refresh token. |
| `/mail draft <to> \| <subject> \| <message>` | Owner only | Creates a Gmail draft in the PROMETHEUS mail account. It does not send immediately. |
| `/mail draft_ai <to> \| <purpose>` | Owner only | Builds an AI-assisted draft preview that requires `CONFIRM DRAFT` before Gmail draft creation. |
| `/mail drafts` | Owner only | Lists recent live Gmail drafts with numbers. |
| `/mail send <number>` | Owner only | Sends the numbered draft from `/mail drafts`, such as `/mail send 1`. |
| `/mail send <draft_id>` | Owner only | Sends a specific Gmail draft ID. |
| `/mail preview <draft_id>` | Owner only | Shows the stored PROMETHEUS draft record preview, when Supabase recorded it. |
| `/mail discard <draft_id>` | Owner only | Discards a Gmail draft and marks the local record discarded when available. |

## Natural Owner Questions

The owner can also ask normal questions that map to log/admin functions:

| Example | What PROMETHEUS checks |
| --- | --- |
| `Did Vathanya talk to you?` | Checks PROMETHEUS bot logs for Vathanya. |
| `What did Aksharaa ask?` | Shows recent Aksharaa bot-log messages. |
| `Show Maddhurika logs.` | Shows Maddhurika's recent bot logs. |
| `Who messaged you today?` | Checks today's PROMETHEUS bot activity. |

## Natural Owner Capability Checks

PROMETHEUS also answers direct owner capability questions without asking generic follow-up questions.

| Example | What PROMETHEUS does |
| --- | --- |
| `check whether you can send text to my trusted contact` | Lists linked/unlinked trusted contacts and shows `/tell` syntax. |
| `can you text Aksharaa` | Checks Aksharaa's linked status and returns `/tell aksharaa <message>` if available. |
| `can you tell Vathanya` | Checks Vathanya's linked status and explains if she must run `/start` first. |
| `problem solver and emotional supporter` | Acknowledges the owner-mode role directly without a question loop. |
| `nothing but a tired mind` | Gives a short supportive reset response without ending in generic “How can I help?” wording. |

Answer-first rule: PROMETHEUS should answer or act first, then ask at most one follow-up only when required.

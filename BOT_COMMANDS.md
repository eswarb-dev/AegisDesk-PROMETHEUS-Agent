# PROMETHEUS Bot Commands

Scope note: PROMETHEUS can only store, summarize, search, and export conversations that happen inside `@AegisDesk_PrometheusBot`.

## Role-Based Telegram Menus

Telegram command menus are scoped by role to reduce clutter. Menu visibility is only a UI convenience; server-side role checks remain mandatory for every restricted command.

### Public Menu

- `/start`
- `/help`
- `/about`
- `/ping`
- `/privacy`
- `/forgetme`
- `/whoami`

### Trusted Contact Menu

- `/start`
- `/help`
- `/about`
- `/ping`
- `/privacy`
- `/forgetme`
- `/whoami`
- `/supportoff`

### Owner Menu

- `/start`
- `/help`
- `/about`
- `/ping`
- `/whoami`
- `/memory`
- `/contacts`
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
| `/help owner` | Owner only | Shows owner memory commands. |

## Trusted Contact Management

| Command | Access | Description |
| --- | --- | --- |
| `/contacts` | Owner only | Lists trusted contacts and pending users. |
| `/trust <telegram_user_id> <contact_id>` | Owner only | Approves a pending user as a trusted contact. Allowed contacts: `aksharaa`, `vathanya`, `maddhurika`. |
| `/untrust <contact_id>` | Owner only | Revokes a trusted contact link. |
| `/tell <contact_id> <message>` | Owner only | Sends a direct bot message to an approved trusted contact. |
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

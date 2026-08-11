# PROMETHEUS Bot Commands

Scope note: PROMETHEUS can only store, summarize, search, and export conversations that happen inside `@AegisDesk_PrometheusBot`.

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

## Trusted Contact Management

| Command | Access | Description |
| --- | --- | --- |
| `/contacts` | Owner only | Lists trusted contacts and pending users. |
| `/trust <telegram_user_id> <contact_id>` | Owner only | Approves a pending user as a trusted contact. Allowed contacts: `aksharaa`, `vathanya`, `maddhurika`. |
| `/untrust <contact_id>` | Owner only | Revokes a trusted contact link. |
| `/tell <contact_id> <message>` | Owner only | Sends a direct bot message to an approved trusted contact. |

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

## Trusted Support Commands

| Command | Access | Description |
| --- | --- | --- |
| `/support` | Owner only | Shows recent trusted-support events. |
| `/support <contact_id>` | Owner only | Shows recent trusted-support summaries for one contact. |
| `/support alerts` | Owner only | Shows owner support alerts that were created/sent. |
| `/support settings` | Owner only | Shows support-alert limits and scope rules. |
| `/supportoff` | Approved trusted contacts only | Disables non-critical support memory for that contact. Critical safety handling remains active. |

## Natural Owner Questions

The owner can also ask normal questions that map to log/admin functions:

| Example | What PROMETHEUS checks |
| --- | --- |
| `Did Vathanya talk to you?` | Checks PROMETHEUS bot logs for Vathanya. |
| `What did Aksharaa ask?` | Shows recent Aksharaa bot-log messages. |
| `Show Maddhurika logs.` | Shows Maddhurika's recent bot logs. |
| `Who messaged you today?` | Checks today's PROMETHEUS bot activity. |


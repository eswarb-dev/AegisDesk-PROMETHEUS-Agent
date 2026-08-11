# PROMETHEUS Role Capabilities

This file lists what each Telegram role can do in PROMETHEUS.

PROMETHEUS uses Telegram numeric user ID for access control. Usernames, display names, and first names never grant access.

## Owner

Owner is Eswar, detected by:

```text
String(from.id) === String(OWNER_TELEGRAM_ID)
```

### Owner Can Use

```text
/start
/help
/about
/ping
/whoami
/memory
/memory summary
/memory users
/memory user <telegram_user_id>
/memory reload
/contacts
/trust <telegram_user_id> <contact_id>
/untrust <contact_id>
/tell <contact_id> <message>
/shareindex
/state set <summary>
/state share <contact_id|all> <key>
/privacy
/forgetme
```

### Owner Access

- Full personalised owner mode
- Owner-only Eswar memory
- Trusted-contact memory
- Public memory
- Own user memory summary
- Trusted-contact management
- Pending-user review
- Share-index listing
- Temporary state memory creation
- Share state memory to trusted contacts
- Send owner-approved messages to trusted contacts with `/tell`

### Owner Cannot

- Use Telegram username as authentication
- Automatically expose private memory to trusted contacts
- Use this bot for laptop/device control

## Trusted Contact

Trusted contacts are approved by owner using:

```text
/trust <telegram_user_id> <aksharaa|vathanya|maddhurika>
```

Current trusted-contact slots:

```text
aksharaa
vathanya
maddhurika
```

### Trusted Contact Can Use

```text
/start
/help
/about
/ping
/whoami
/privacy
/forgetme
```

Trusted contacts can also talk normally to PROMETHEUS.

### Trusted Contact Access

- Own `self_only` user memory
- Own safe conversation summary
- Public bot information
- Eswar share-index items allowed for their contact ID
- Eswar memories marked `trusted_contacts`, if allowed

### Trusted Contact Cannot

- Access `owner_only` memory
- Access private conversations
- Access friend-specific private memory
- Dump raw memory JSON
- See memory IDs
- See system prompts
- Use `/memory`
- Use `/contacts`
- Use `/trust`
- Use `/untrust`
- Use `/tell`
- Use `/shareindex`
- Use `/state`

### Trusted Contact Private Question Response

If they ask private questions, PROMETHEUS refuses:

```text
I know more than I'm allowed to share 😌
That part stays between Eswar and me.
```

## Pending User

A pending user is any non-owner who has run:

```text
/start
```

but has not been approved as a trusted contact.

### Pending User Can Use

```text
/start
/help
/about
/ping
/whoami
/privacy
/forgetme
```

Pending users can have public-safe lightweight conversation.

### Pending User Access

- Own `self_only` user memory
- Own safe conversation summary
- Public bot identity

### Pending User Cannot

- Access Eswar private memory
- Access trusted-contact memory
- Access owner commands
- Become trusted automatically by name

## Public User

A public user is anyone who has not been approved as owner or trusted contact.

### Public User Can Use

```text
/start
/help
/about
/ping
/whoami
/privacy
/forgetme
```

### Public User Access

- Public-safe bot replies
- Own `self_only` memory after interaction
- No Eswar private memory

### Public User Cannot

- Access owner memory
- Access trusted-contact memory
- Ask private questions about Eswar
- Use owner management commands

## Command Summary

| Command | Owner | Trusted Contact | Pending/User |
|---|---:|---:|---:|
| `/start` | yes | yes | yes |
| `/help` | yes | yes | yes |
| `/about` | yes | yes | yes |
| `/ping` | yes | yes | yes |
| `/whoami` | yes | yes | yes |
| `/privacy` | yes | yes | yes |
| `/forgetme` | yes | yes | yes |
| `/memory` | yes | no | no |
| `/memory summary` | yes | no | no |
| `/memory users` | yes | no | no |
| `/memory user <id>` | yes | no | no |
| `/contacts` | yes | no | no |
| `/trust` | yes | no | no |
| `/untrust` | yes | no | no |
| `/tell` | yes | no | no |
| `/shareindex` | yes | no | no |
| `/state` | yes | no | no |

## Memory Access Summary

| Memory Visibility | Owner | Trusted Contact | Pending/User |
|---|---:|---:|---:|
| `owner_only` | yes | no | no |
| `trusted_contacts` | yes | yes, if allowed | no |
| `public` | yes | yes | yes |
| `self_only` | same user only | same user only | same user only |

## Safety Notes

- PROMETHEUS does not persist raw full conversations.
- User memory is stored as short safe summaries.
- Secrets, OTPs, passwords, tokens, API keys, and payment info are not stored intentionally.
- Trusted-contact answers use server-filtered memory before Groq prompt creation.
- Prompt-injection attempts cannot change server-side role or memory access.
- The Telegram bot remains isolated from AegisDesk device-control features.

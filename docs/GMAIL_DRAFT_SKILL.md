# PROMETHEUS Gmail Draft Skill

Phase 1 creates Gmail drafts only. It does not send email, read inbox, use SMTP, or store Gmail credentials.

## Google Setup

1. Create or open a Google Cloud project.
2. Enable Gmail API.
3. Configure OAuth consent for the PROMETHEUS Gmail account.
4. Create an OAuth client.
5. Add the redirect URI used by `GOOGLE_REDIRECT_URI`.
6. Use the minimum scope:
   `https://www.googleapis.com/auth/gmail.compose`

## Local OAuth

Set:

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
```

Run:

```bash
npx tsx scripts/gmail-oauth-setup.ts
```

Sign in as:

```text
prometheus.inference@gmail.com
```

Copy the printed `GMAIL_REFRESH_TOKEN` into Render environment variables. Do not commit it.

## Render Env Vars

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GMAIL_REFRESH_TOKEN=
GMAIL_SENDER_EMAIL=prometheus.inference@gmail.com
GMAIL_SENDER_NAME=PROMETHEUS
GMAIL_DRAFTS_ENABLED=true
```

## Telegram Commands

```text
/mail
/mail draft <to> | <subject> | <message>
/mail draft_ai <to> | <purpose>
/mail drafts
/mail preview <draft_id>
/mail discard <draft_id>
CONFIRM DRAFT
CANCEL DRAFT
```

`/mail draft` creates a Gmail draft directly because the owner supplied the full body.

`/mail draft_ai` asks Groq for a subject/body preview and requires `CONFIRM DRAFT` before creating the Gmail draft.

## Security

- Owner-only by Telegram ID.
- No `/mail send` in Phase 1.
- No SMTP password login.
- No inbox reads.
- Draft metadata stores only recipient, subject, status, and short body preview.
- OAuth tokens and Gmail credentials are never logged.
- Unsafe/spam/phishing/credential-collection content is rejected before Gmail API calls.

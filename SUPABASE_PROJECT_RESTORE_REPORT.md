# PROMETHEUS Supabase Project Restore Report

## Status

- Old project issue: previous Supabase project is frozen.
- Goal: move PROMETHEUS Telegram Bot to a new Supabase project and restore the existing database backup.
- Scope preserved: Telegram conversational bot only. No A.U.R.A desktop-agent, laptop control, TTS, orb UI, camera, or device-monitoring logic was added.

## Backup Files Found

| File | Size | Detected format | Restore use |
| --- | ---: | --- | --- |
| `db_backup/db_cluster-05-09-2026@12-11-03.backup.gz` | 95,144 bytes | gzip-compressed plain PostgreSQL SQL dump | Use `psql` after temporary decompression |
| `db_backup/vsefbajhxtiptqnbitdp.storage.zip` | 22 bytes | empty ZIP/storage backup structure | Not required for PROMETHEUS memory restore |

The database backup was inspected by file signature only. Backup files were not deleted or modified. No extraction over project files was performed.

## Current Schema Requirements

Core expected tables:

- `telegram_users`
- `memory_items`
- `conversation_summaries`
- `eswar_share_index`
- `trusted_contacts`
- `memory_audit_logs`

Current migration also defines project tables used by implemented features:

- `user_style_profiles`
- `learning_events`
- `bot_messages`
- `trusted_support_events`
- `gmail_drafts`
- `owner_alerts`

Migration file checked: `supabase/migrations/001_prometheus_memory.sql`.

## Local Configuration

`.env` was updated only for the non-secret provider flag:

```text
DATABASE_PROVIDER=supabase
```

Existing secret values were preserved and not printed. Local configuration presence was checked only as `configured=true/false`.

Values that must point at the new Supabase project before runtime validation:

```text
SUPABASE_URL=configured with new project URL
SUPABASE_SERVICE_ROLE_KEY=configured with new service role key
SUPABASE_ANON_KEY=configured with new anon key
```

Preserve these existing values unless intentionally rotating them:

```text
TELEGRAM_BOT_TOKEN
GROQ_API_KEY
GROQ_MODEL
GROQ_MODEL_PRIMARY
GROQ_MODEL_FALLBACK
OWNER_TELEGRAM_ID
BOT_PUBLIC_URL
NODE_ENV
PORT
```


## Restore Attempt On 2026-09-09

`SUPABASE_DB_URL` is now present in `.env` and was used without printing the value.

Restore attempts:

```text
scripts/restore_supabase_backup.ps1: reached restore step, but psql was not found on PATH.
winget PostgreSQL 17 install: failed with installer exit code 1; psql was not installed.
scripts/restore_supabase_backup_node.mjs: direct Postgres connection failed with DNS/IPv6 reachability issues.
scripts/restore_public_tables_from_backup.ts: Supabase REST write fallback failed with PGRST205 on insert, while count-only reads still succeeded.
```

Safe diagnostics:

```text
SUPABASE_DB_URL configured: true
SUPABASE_URL and SUPABASE_DB_URL project refs match: true
SUPABASE_SERVICE_ROLE_KEY JWT role claim: service_role
Supabase REST count verifier: passed, all required tables queryable, all counts still 0
Raw private content printed: false
```

Backup public table row counts found without printing row content:

```text
telegram_users: 6
memory_items: 10
conversation_summaries: 6
eswar_share_index: 3
trusted_contacts: 3
memory_audit_logs: 0
bot_messages: 618
trusted_support_events: 0
owner_alerts: 0
```

Current blocker: the configured direct database host resolves only to an IPv6 address in this environment, and this machine cannot reach that IPv6 address. Use the Supabase dashboard's connection pooler/session pooler PostgreSQL URL for `SUPABASE_DB_URL`, then rerun the restore script. Do not use the REST API URL or anon/service-role keys as the PostgreSQL connection string.

## Continuation Update On 2026-09-09

The restore was continued from the failed state without deleting backup files and without printing secrets or raw memory rows.

Current `SUPABASE_DB_URL` diagnostics:

```text
SUPABASE_DB_URL configured: true
SUPABASE_DB_URL direct host: true
SUPABASE_DB_URL pooler host: false
Direct host rejected before restore: true
```

The restore script now stops before connecting when `SUPABASE_DB_URL` uses the direct `db.<project-ref>.supabase.co` host. Replace it with the Supabase Dashboard Database Connection Pooler / Session Pooler PostgreSQL URL, then rerun:

```powershell
$env:PROMETHEUS_RESTORE_CONFIRM="RESTORE"
$env:RESTORE_MODE="data_only"
node scripts\restore_supabase_backup_node.mjs
```

Node pg restore path status:

```text
scripts/restore_supabase_backup_node.mjs updated: true
Direct host rejection added: true
Pooler host detection added: true
RESTORE_MODE=data_only support added: true
Restore completed: true
Reason: current SUPABASE_DB_URL is still the direct database host
```

The Supabase REST insert fallback remains bypassed for restore. REST count verification is still used for safe validation only.

Current count-only verification after the blocked restore:

```text
Supabase configured: true
telegram_users: 6
memory_items: 10
conversation_summaries: 6
eswar_share_index: 3
trusted_contacts: 3
memory_audit_logs: 0
Additional current schema tables:
user_style_profiles: 0
learning_events: 0
bot_messages: 0
trusted_support_events: 0
gmail_drafts: 0
owner_alerts: 0
Owner/memory/trusted records present: false
Raw private content printed: false
```

Expected backup counts remain:

```text
telegram_users: 6
memory_items: 10
conversation_summaries: 6
eswar_share_index: 3
trusted_contacts: 3
bot_messages: 618
memory_audit_logs: 0
trusted_support_events: 0
owner_alerts: 0
```

Validation after script and test fix:

```text
npm run build: passed
npm test: passed, 27 test files and 252 tests
npx tsx scripts/verify_supabase_restore.ts: passed, counts still 0 because restore is blocked by direct DB URL
```

Owner response validation fix:

```text
tests/ownerIntent.test.ts now passes
Time-of-day greetings after acknowledgement-style owner messages are rejected
```

## Final Restore Completion On 2026-09-09

The `.env` `SUPABASE_DB_URL` was changed to a Supabase session pooler URL and used without printing the value.

Restore path used:

```text
Schema preparation: scripts/restore_supabase_backup_node.mjs supabase/migrations/001_prometheus_memory.sql with RESTORE_MODE=full
Data restore: scripts/restore_supabase_backup_node.mjs with RESTORE_MODE=data_only
Connection path: Node pg through Supabase session pooler
Direct host rejected: false after pooler update
Pooler host detected: true
Restore completed: true
Raw private content printed: false
```

Data-only restore behavior:

```text
PROMETHEUS public tables truncated before restore: true
COPY sections restored: 9
COPY sections skipped: 34
Skipped schemas: auth, storage, vault, realtime
```

Final count-only verification:

```text
Supabase configured: true
telegram_users: 6
memory_items: 10
conversation_summaries: 6
eswar_share_index: 3
trusted_contacts: 3
memory_audit_logs: 0
Additional current schema tables:
user_style_profiles: 0
learning_events: 0
bot_messages: 618
trusted_support_events: 0
gmail_drafts: 0
owner_alerts: 0
Owner/memory/trusted records present: true
Raw private content printed: false
```

Final validation:

```text
npm run build: passed
npm test: passed, 27 test files and 252 tests
```

Remaining Render steps:

```text
Update Render SUPABASE_URL to the new project URL.
Update Render SUPABASE_SERVICE_ROLE_KEY to the new service role key.
Update Render SUPABASE_ANON_KEY to the new anon key.
Set Render DATABASE_PROVIDER=supabase.
Keep TELEGRAM_BOT_TOKEN and OWNER_TELEGRAM_ID unchanged unless intentionally rotating them.
Redeploy after Render env is updated.
```

## Restore Method

Restore script created:

```text
scripts/restore_supabase_backup.ps1
```

The script:

- requires `SUPABASE_DB_URL` from the current environment
- does not print `SUPABASE_DB_URL` or the database password
- verifies the backup file exists
- detects plain SQL versus PostgreSQL custom format
- warns that restore may overwrite or conflict with existing tables
- requires typing `RESTORE` before executing
- uses `psql` for plain SQL dumps
- uses `pg_restore` for PostgreSQL custom dumps
- temporarily decompresses `.gz` backups into the OS temp directory and removes the temporary file afterward
- stops on restore errors

Run restore from the project root:

```powershell
$env:SUPABASE_DB_URL="postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restore_supabase_backup.ps1
```

Recommended target: a fresh empty Supabase project.

## Validation Script

Validation script created:

```text
scripts/verify_supabase_restore.ts
```

It connects with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, counts rows only, and does not print raw private content.

Expected output shape:

```text
Supabase configured: true
telegram_users: <count>
memory_items: <count>
conversation_summaries: <count>
eswar_share_index: <count>
trusted_contacts: <count>
memory_audit_logs: <count>
Additional current schema tables:
user_style_profiles: <count>
learning_events: <count>
bot_messages: <count>
trusted_support_events: <count>
gmail_drafts: <count>
owner_alerts: <count>
Owner/memory/trusted records present: true|false
Raw private content printed: false
```

Run after restore:

```bash
npm run build
npx tsx scripts/verify_supabase_restore.ts
```

## Validation Results

Completed local validation in this pass:

```text
npm install: passed; dependencies already up to date; npm reported 5 moderate vulnerabilities
npm run build: passed
npm test: passed, 27 test files and 252 tests
npx tsx scripts/verify_supabase_restore.ts: passed against the currently configured Supabase env
```

Current Supabase verification counts:

```text
Supabase configured: true
telegram_users: 6
memory_items: 10
conversation_summaries: 6
eswar_share_index: 3
trusted_contacts: 3
memory_audit_logs: 0
Additional current schema tables:
user_style_profiles: 0
learning_events: 0
bot_messages: 0
trusted_support_events: 0
gmail_drafts: 0
owner_alerts: 0
Owner/memory/trusted records present: false
Raw private content printed: false
```

This means the configured Supabase project is reachable and has queryable tables, but the backup data has not been restored there yet because `SUPABASE_DB_URL` is still the direct database host. Replace it with the Supabase session pooler URL and rerun the restore.

Commands still to run after `SUPABASE_DB_URL` is changed to the session pooler URL and the restore script completes:

```bash
npm run build
npm test
npx tsx scripts/verify_supabase_restore.ts
```
Local runtime checks after restore verification:

```bash
npm run dev
```

Then check:

```text
GET /health
GET /health/groq
```

Do not use `/health/groq` as a keep-awake ping.
## Migration Fallback

If direct DB restore fails:

1. Do not modify or delete backup files.
2. Capture the exact restore error without printing secrets or raw memory.
3. Apply `supabase/migrations/001_prometheus_memory.sql` to the new project.
4. Run `npm run migrate:memory` only if local JSON data files are still valid and the migration script remains present.

The JSON migration path should remain idempotent and print summary counts only.

## Storage Backup

`db_backup/vsefbajhxtiptqnbitdp.storage.zip` was not restored. PROMETHEUS memory belongs in Supabase Postgres, not Supabase Storage. Restore storage only if a future source audit confirms the bot uses Supabase Storage for non-memory assets.

## Render Reminder

Do not deploy automatically.

Update Render environment variables manually:

```text
DATABASE_PROVIDER=supabase
SUPABASE_URL=<new project URL>
SUPABASE_SERVICE_ROLE_KEY=<new service role key>
SUPABASE_ANON_KEY=<new anon key>
```

Keep these unchanged unless intentionally rotated:

```text
TELEGRAM_BOT_TOKEN
OWNER_TELEGRAM_ID
GROQ_API_KEY
GROQ_MODEL
GROQ_MODEL_PRIMARY
GROQ_MODEL_FALLBACK
```

Redeploy only after restore verification, `npm run build`, and `npm test` pass.

## Security Notes

- `.env` must not be committed.
- Real secrets were not printed in this report.
- Full database URLs were not printed.
- Raw memory rows were not printed.
- Owner-only memory remains server-filtered and must never be exposed to trusted contacts or public users.
- Owner and trusted-contact matching must remain based on Telegram numeric user IDs, not usernames.









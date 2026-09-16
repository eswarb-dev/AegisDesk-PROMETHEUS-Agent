import "dotenv/config";
import fs from "node:fs";
import zlib from "node:zlib";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";

const backupFile = process.argv[2] ?? "db_backup/db_cluster-05-09-2026@12-11-03.backup.gz";
const restoreMode = (process.env.RESTORE_MODE ?? "full").toLowerCase();
const publicDataTables = new Set([
  "public.telegram_users",
  "public.memory_items",
  "public.conversation_summaries",
  "public.eswar_share_index",
  "public.trusted_contacts",
  "public.memory_audit_logs",
  "public.bot_messages",
  "public.trusted_support_events",
  "public.owner_alerts"
]);

function configured(value) {
  return Boolean(value && value.trim().length > 0);
}

function sanitize(message) {
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "postgresql://[redacted]")
    .replace(/db\.[a-z0-9-]+\.supabase\.co/gi, "db.[redacted].supabase.co")
    .replace(/[a-z0-9.-]*pooler\.supabase\.com/gi, "[redacted].pooler.supabase.com");
}

function validateDbUrlShape(dbUrl) {
  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch {
    throw new Error("SUPABASE_DB_URL is not a valid PostgreSQL URL.");
  }

  const host = parsed.hostname.toLowerCase();
  const isDirect = /^db\.[^.]+\.supabase\.co$/.test(host);
  const isPooler = host.includes("pooler.supabase.com") || host.includes("pooler.supabase.co") || host.includes("pooler");

  console.log(`SUPABASE_DB_URL configured: ${configured(dbUrl)}`);
  console.log(`SUPABASE_DB_URL direct host: ${isDirect}`);
  console.log(`SUPABASE_DB_URL pooler host: ${isPooler}`);

  if (isDirect) {
    throw new Error("SUPABASE_DB_URL appears to be the direct database host. Use the Supabase session pooler URL.");
  }
  if (!isPooler) {
    console.log("SUPABASE_DB_URL pooler host not recognized; continuing only because it is not the direct Supabase DB host.");
  }

  return parsed;
}

function readBackupText(path) {
  if (!fs.existsSync(path)) throw new Error(`Backup file not found: ${path}`);
  const bytes = fs.readFileSync(path);
  const isGzip = path.toLowerCase().endsWith(".gz") || (bytes[0] === 0x1f && bytes[1] === 0x8b);
  console.log(`Backup file: ${path}`);
  console.log(`Backup gzip detected: ${isGzip}`);
  const sqlBytes = isGzip ? zlib.gunzipSync(bytes) : bytes;
  return sqlBytes.toString("utf8");
}

function createSqlSplitter() {
  let statement = "";
  let inSingle = false;
  let inDouble = false;
  let dollarTag = null;

  function feed(line) {
    statement += line + "\n";
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (!inSingle && !inDouble && !dollarTag && char === "-" && next === "-") break;
      if (!inDouble && !dollarTag && char === "'") {
        if (inSingle && next === "'") i += 1;
        else inSingle = !inSingle;
        continue;
      }
      if (!inSingle && !dollarTag && char === '"') {
        inDouble = !inDouble;
        continue;
      }
      if (!inSingle && !inDouble && char === "$") {
        const match = line.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
        if (match) {
          if (dollarTag === match[0]) dollarTag = null;
          else if (!dollarTag) dollarTag = match[0];
          i += match[0].length - 1;
          continue;
        }
      }
      if (!inSingle && !inDouble && !dollarTag && char === ";") {
        const complete = statement;
        statement = "";
        return complete;
      }
    }
    return null;
  }

  function flush() {
    const trimmed = statement.trim();
    statement = "";
    return trimmed ? trimmed : null;
  }

  return { feed, flush };
}

function copyTableName(sql) {
  const match = sql.match(/^COPY\s+([^\s(]+)\s*\(/i);
  return match?.[1] ?? "";
}

async function runCopy(client, copySql, rows) {
  const stream = client.query(copyFrom(copySql.trim()));
  Readable.from(rows.map((line) => line + "\n")).pipe(stream);
  await finished(stream);
}

async function truncatePublicDataTables(client) {
  const tables = [...publicDataTables].join(", ");
  await client.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  console.log("Data-only pre-clean: PROMETHEUS public tables truncated");
}

async function runDataOnlyRestore(client, lines) {
  let copies = 0;
  let skippedCopies = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^COPY\s+([^\s(]+)\s*\([^)]*\)\s+FROM\s+stdin;/i);
    if (!match) continue;
    const table = match[1];
    const rows = [];
    i += 1;
    while (i < lines.length && lines[i] !== "\\.") {
      rows.push(lines[i]);
      i += 1;
    }
    if (!publicDataTables.has(table)) {
      skippedCopies += 1;
      continue;
    }
    copies += 1;
    await runCopy(client, lines[i - rows.length - 1], rows);
  }
  return { copies, skippedCopies };
}
async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!configured(dbUrl)) throw new Error("SUPABASE_DB_URL is required and will not be printed.");
  const parsedDbUrl = validateDbUrlShape(dbUrl);

  if (process.env.PROMETHEUS_RESTORE_CONFIRM !== "RESTORE") {
    throw new Error("Set PROMETHEUS_RESTORE_CONFIRM=RESTORE to run this restore.");
  }
  if (!["full", "data_only"].includes(restoreMode)) {
    throw new Error("RESTORE_MODE must be full or data_only.");
  }

  console.log(`Restore mode: ${restoreMode}`);
  console.log("WARNING: Restoring may overwrite or conflict with existing tables. Fresh empty Supabase project is recommended.");
  if (restoreMode === "data_only") {
    console.log("Data-only mode: executing public PROMETHEUS COPY data sections only; schemas auth, storage, vault, and realtime are skipped.");
  }

  const lines = readBackupText(backupFile).split(/\r?\n/);
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false, servername: parsedDbUrl.hostname } });
  await client.connect();

  let statements = 0;
  let copies = 0;
  let skippedCopies = 0;

  try {
    if (restoreMode === "data_only") {
      await truncatePublicDataTables(client);
      const result = await runDataOnlyRestore(client, lines);
      copies = result.copies;
      skippedCopies = result.skippedCopies;
    } else {
      const splitter = createSqlSplitter();
      for (let i = 0; i < lines.length; i += 1) {
        const complete = splitter.feed(lines[i]);
        if (!complete) continue;
        const sql = complete.trim();
        if (!sql || sql.startsWith("--")) continue;
        if (/^COPY\s/i.test(sql) && /\sFROM\sstdin;?\s*$/i.test(sql)) {
          const rows = [];
          i += 1;
          while (i < lines.length && lines[i] !== "\\.") {
            rows.push(lines[i]);
            i += 1;
          }
          copies += 1;
          await runCopy(client, sql, rows);
        } else {
          statements += 1;
          await client.query(sql);
        }
      }

      const tail = splitter.flush();
      if (tail) {
        statements += 1;
        await client.query(tail);
      }
    }

    console.log(`SQL statements executed: ${statements}`);
    console.log(`COPY sections restored: ${copies}`);
    console.log(`COPY sections skipped: ${skippedCopies}`);
    console.log("Raw private content printed: false");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fallback restore failed: ${sanitize(message)}`);
  console.log("Raw private content printed: false");
  process.exitCode = 1;
});



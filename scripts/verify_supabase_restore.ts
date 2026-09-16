import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const requiredTables = [
  "telegram_users",
  "memory_items",
  "conversation_summaries",
  "eswar_share_index",
  "trusted_contacts",
  "memory_audit_logs"
] as const;

const currentSchemaTables = [
  "user_style_profiles",
  "learning_events",
  "bot_messages",
  "trusted_support_events",
  "gmail_drafts",
  "owner_alerts"
] as const;

function configured(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

async function countTable(client: ReturnType<typeof createClient>, table: string): Promise<number> {
  const { count, error } = await client.from(table).select("*", { count: "exact", head: true });
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isConfigured = configured(supabaseUrl) && configured(serviceRoleKey);

  console.log(`Supabase configured: ${isConfigured}`);
  if (!isConfigured) {
    process.exitCode = 1;
    return;
  }

  const client = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const counts = new Map<string, number>();
  for (const table of [...requiredTables, ...currentSchemaTables]) {
    counts.set(table, await countTable(client, table));
  }

  for (const table of requiredTables) {
    console.log(`${table}: ${counts.get(table)}`);
  }

  console.log("Additional current schema tables:");
  for (const table of currentSchemaTables) {
    console.log(`${table}: ${counts.get(table)}`);
  }

  const ownerOrTrustedRecords =
    (counts.get("telegram_users") ?? 0) > 0 ||
    (counts.get("memory_items") ?? 0) > 0 ||
    (counts.get("trusted_contacts") ?? 0) > 0;

  console.log(`Owner/memory/trusted records present: ${ownerOrTrustedRecords}`);
  console.log("Raw private content printed: false");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Restore verification failed: ${message}`);
  console.log("Raw private content printed: false");
  process.exitCode = 1;
});

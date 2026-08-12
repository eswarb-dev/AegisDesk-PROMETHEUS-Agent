import { loadConfig } from "../src/config.js";
import { createSupabaseServerClient } from "../src/storage/supabaseClient.js";
import type { TelegramUserRow } from "../src/storage/userRepository.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const ownerId = String(config.ownerTelegramId);
  if (!ownerId) throw new Error("OWNER_TELEGRAM_ID is required");
  const supabase = createSupabaseServerClient(config);

  const { data, error } = await supabase
    .from("telegram_users")
    .select("id, telegram_user_id, chat_id, username, display_name, role, contact_id, memory_enabled, approved, created_at, updated_at, last_seen_at");
  if (error) throw error;

  const ownerRows = (data ?? []).filter((row) => String(row.telegram_user_id) === ownerId) as Array<TelegramUserRow & { id: string }>;
  const invalidOwners = (data ?? []).filter((row) => row.role === "owner" && String(row.telegram_user_id) !== ownerId);

  let ownerRowsMerged = 0;
  if (ownerRows.length) {
    const keep = pickKeepRow(ownerRows);
    const merged = ownerRows.reduce(mergeRows);
    await supabase
      .from("telegram_users")
      .update({
        telegram_user_id: ownerId,
        chat_id: merged.chat_id ?? ownerId,
        username: merged.username,
        display_name: merged.display_name ?? "Eswar B",
        role: "owner",
        contact_id: null,
        approved: true,
        memory_enabled: true,
        created_at: merged.created_at,
        updated_at: new Date().toISOString(),
        last_seen_at: merged.last_seen_at
      })
      .eq("id", keep.id)
      .throwOnError();
    const deleteIds = ownerRows.map((row) => row.id).filter((id) => id !== keep.id);
    if (deleteIds.length) {
      await supabase.from("telegram_users").delete().in("id", deleteIds).throwOnError();
      ownerRowsMerged = deleteIds.length;
    }
  }

  if (invalidOwners.length) {
    await supabase
      .from("telegram_users")
      .update({ role: "user", contact_id: null, approved: false, updated_at: new Date().toISOString() })
      .in("id", invalidOwners.map((row) => row.id))
      .throwOnError();
    console.warn(JSON.stringify({ level: "warn", message: "invalid_owner_role_corrected", count: invalidOwners.length }));
  }

  const { data: ownerContactLinks } = await supabase
    .from("trusted_contacts")
    .select("contact_id")
    .eq("telegram_user_id", ownerId);
  if (ownerContactLinks?.length) {
    await supabase
      .from("trusted_contacts")
      .update({ telegram_user_id: null, chat_id: null, approved: false, updated_at: new Date().toISOString() })
      .eq("telegram_user_id", ownerId)
      .throwOnError();
  }

  console.log(JSON.stringify({
    owner_rows_found: ownerRows.length,
    owner_rows_merged: ownerRowsMerged,
    invalid_owner_rows_corrected: invalidOwners.length,
    owner_trusted_contact_links_removed: ownerContactLinks?.length ?? 0
  }));
}

function pickKeepRow<T extends TelegramUserRow & { id: string }>(rows: T[]): T {
  return [...rows].sort((a, b) => completeness(b) - completeness(a) || new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())[0];
}

function mergeRows<T extends TelegramUserRow>(left: T, right: T): T {
  return {
    ...left,
    ...right,
    chat_id: right.chat_id ?? left.chat_id,
    username: right.username ?? left.username,
    display_name: right.display_name ?? left.display_name,
    created_at: earliest(left.created_at, right.created_at),
    updated_at: latest(left.updated_at, right.updated_at),
    last_seen_at: latest(left.last_seen_at, right.last_seen_at)
  };
}

function completeness(row: TelegramUserRow): number {
  return [row.chat_id, row.username, row.display_name, row.last_seen_at].filter(Boolean).length;
}

function earliest(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function latest(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

void main().catch((error) => {
  console.error(JSON.stringify({ level: "error", message: "fix_owner_identity_failed", error_type: error instanceof Error ? error.name : "unknown" }));
  process.exitCode = 1;
});

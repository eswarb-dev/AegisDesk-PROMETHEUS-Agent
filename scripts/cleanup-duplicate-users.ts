import { createSupabaseServerClient } from "../src/storage/supabaseClient.js";
import { loadConfig } from "../src/config.js";
import type { TelegramUserRow } from "../src/storage/userRepository.js";

const ROLE_PRIORITY = { owner: 0, trusted_contact: 1, pending: 2, user: 3 } as const;

async function main(): Promise<void> {
  const config = loadConfig();
  const supabase = createSupabaseServerClient(config);
  const { data, error } = await supabase
    .from("telegram_users")
    .select("id, telegram_user_id, chat_id, username, display_name, role, contact_id, memory_enabled, approved, created_at, updated_at, last_seen_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const groups = new Map<string, Array<TelegramUserRow & { id: string }>>();
  for (const row of data ?? []) {
    const key = String(row.telegram_user_id);
    const list = groups.get(key) ?? [];
    list.push(row as TelegramUserRow & { id: string });
    groups.set(key, list);
  }

  let cleaned = 0;
  for (const [telegramUserId, rows] of groups.entries()) {
    const normalized = rows.map((row) => normalizeRole(row, config.ownerTelegramId));
    const merged = normalized.reduce(mergeRows);
    const keep = pickKeepRow(normalized);
    const deleteIds = rows.map((row) => row.id).filter((id) => id !== keep.id);
    await supabase
      .from("telegram_users")
      .update({
        telegram_user_id: telegramUserId,
        chat_id: merged.chat_id,
        username: merged.username,
        display_name: merged.display_name,
        role: merged.role,
        contact_id: merged.contact_id,
        memory_enabled: merged.memory_enabled,
        approved: merged.approved,
        created_at: merged.created_at,
        updated_at: new Date().toISOString(),
        last_seen_at: merged.last_seen_at
      })
      .eq("id", keep.id)
      .throwOnError();
    if (deleteIds.length) {
      await supabase.from("telegram_users").delete().in("id", deleteIds).throwOnError();
      cleaned += deleteIds.length;
    }
  }

  await supabase.rpc("exec_sql", { sql: "alter table telegram_users add constraint telegram_users_telegram_user_id_key unique (telegram_user_id)" }).then(() => undefined, () => undefined);
  console.log(JSON.stringify({ cleaned_duplicates: cleaned }));
}

function normalizeRole<T extends TelegramUserRow>(row: T, ownerTelegramId: string): T {
  if (row.role === "owner" && String(row.telegram_user_id) !== String(ownerTelegramId)) {
    console.warn(JSON.stringify({ level: "warn", message: "invalid_owner_role_corrected", telegram_user_id: row.telegram_user_id }));
    return { ...row, role: row.approved ? "trusted_contact" : "user" };
  }
  if (String(row.telegram_user_id) === String(ownerTelegramId)) return { ...row, role: "owner" };
  return row;
}

function mergeRows<T extends TelegramUserRow>(left: T, right: T): T {
  const latest = isAfter(right.updated_at, left.updated_at) ? right : left;
  return {
    ...left,
    ...latest,
    role: ROLE_PRIORITY[right.role] < ROLE_PRIORITY[left.role] ? right.role : left.role,
    chat_id: latest.chat_id ?? left.chat_id ?? right.chat_id,
    username: latest.username ?? left.username ?? right.username,
    display_name: latest.display_name ?? left.display_name ?? right.display_name,
    contact_id: latest.contact_id ?? left.contact_id ?? right.contact_id,
    created_at: earliest(left.created_at, right.created_at),
    last_seen_at: latestDate(left.last_seen_at, right.last_seen_at),
    updated_at: latestDate(left.updated_at, right.updated_at),
    memory_enabled: latest.memory_enabled ?? left.memory_enabled ?? right.memory_enabled,
    approved: latest.approved ?? left.approved ?? right.approved
  };
}

function pickKeepRow<T extends TelegramUserRow & { id: string }>(rows: T[]): T {
  return [...rows].sort((a, b) => completeness(b) - completeness(a) || new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())[0];
}

function completeness(row: TelegramUserRow): number {
  return [row.chat_id, row.username, row.display_name, row.contact_id, row.last_seen_at].filter(Boolean).length;
}

function isAfter(a?: string | null, b?: string | null): boolean {
  return new Date(a ?? 0).getTime() > new Date(b ?? 0).getTime();
}

function earliest(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function latestDate(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

void main().catch((error) => {
  console.error(JSON.stringify({ level: "error", message: "cleanup_duplicate_users_failed", error_type: error instanceof Error ? error.name : "unknown" }));
  process.exitCode = 1;
});

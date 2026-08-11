import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { loadConfig } from "../src/config.js";
import { createSupabaseServerClient } from "../src/storage/supabaseClient.js";
import type { EswarMemory } from "../src/memory/memoryTypes.js";
import type { TrustedContactsData } from "../src/contacts/trustedContactTypes.js";
import type { ShareIndexData } from "../src/memory/shareIndexStore.js";
import type { UserMemoriesData } from "../src/memory/userMemoryStore.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "src/data");

async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path.join(dataDir, fileName), "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  const config = loadConfig({ ...process.env, NODE_ENV: process.env.NODE_ENV ?? "development", DATABASE_PROVIDER: "supabase" });
  const supabase = createSupabaseServerClient(config);
  const counts = {
    telegram_users: 0,
    trusted_contacts: 0,
    conversation_summaries: 0,
    self_memory_items: 0,
    user_memories: 0,
    owner_memories: 0,
    share_indexes: 0
  };

  const trusted = await readJson<TrustedContactsData>("trusted_contacts.json", { trusted_contacts: [], pending_users: [] });
  for (const contact of trusted.trusted_contacts) {
    const { error } = await supabase.from("trusted_contacts").upsert(
      {
        contact_id: contact.id,
        telegram_user_id: contact.telegram_user_id ? String(contact.telegram_user_id) : null,
        chat_id: contact.chat_id ? String(contact.chat_id) : null,
        display_name: contact.name,
        username: contact.username,
        approved: contact.enabled,
        notification_enabled: contact.permissions.receive_agent_messages,
        last_seen_at: contact.last_seen
      },
      { onConflict: "contact_id" }
    );
    if (error) throw error;
    counts.trusted_contacts += 1;
  }
  for (const user of trusted.pending_users) {
    const { error } = await supabase.from("telegram_users").upsert(
      {
        telegram_user_id: String(user.telegram_user_id),
        chat_id: String(user.chat_id),
        username: user.username ?? null,
        display_name: user.display_name,
        role: "pending",
        approved: false,
        last_seen_at: user.last_seen
      },
      { onConflict: "telegram_user_id" }
    );
    if (error) throw error;
    counts.telegram_users += 1;
  }

  const userMemories = await readJson<UserMemoriesData>("user_memories.json", { users: [] });
  for (const user of userMemories.users) {
    const { error: userError } = await supabase.from("telegram_users").upsert(
      {
        telegram_user_id: user.telegram_user_id,
        chat_id: user.chat_id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        contact_id: user.contact_id,
        memory_enabled: user.memory_enabled,
        last_seen_at: user.last_seen
      },
      { onConflict: "telegram_user_id" }
    );
    if (userError) throw userError;
    counts.telegram_users += 1;

    const summary = user.conversation_summary || "No conversation summary stored yet.";
    const { error: summaryError } = await supabase.from("conversation_summaries").upsert(
      {
        telegram_user_id: user.telegram_user_id,
        role: user.role,
        contact_id: user.contact_id,
        short_summary: summary,
        last_message_at: user.last_seen
      },
      { onConflict: "telegram_user_id" }
    );
    if (summaryError) throw summaryError;
    counts.conversation_summaries += 1;
    counts.user_memories += 1;

    const selfItems = [...user.preferences, ...user.important_context, ...user.safe_notes];
    for (const item of selfItems) {
      const { error } = await supabase.from("memory_items").upsert(
        {
          owner_telegram_user_id: user.telegram_user_id,
          subject_type: "user",
          subject_key: item.id,
          memory_type: item.type,
          content: item.content,
          summary: item.content,
          visibility: "self_only",
          allowed_contacts: [],
          source: item.source,
          confidence: item.confidence,
          sensitivity: item.sensitivity,
          expires_at: item.expires_at,
          review_required: item.review_required
        },
        { onConflict: "subject_type,subject_key" }
      );
      if (error) throw error;
      counts.self_memory_items += 1;
    }
  }

  const eswarMemory = await readJson<EswarMemory>("eswar_memory.json", {
    owner: { name: "Eswar B", preferred_name: "Eswar", role: "owner" },
    personality_preferences: {},
    identity: {},
    projects: [],
    people: [],
    preferences: [],
    important_memories: [],
    do_not_claim: []
  });
  const ownerItems = [...eswarMemory.projects, ...eswarMemory.people, ...eswarMemory.preferences, ...eswarMemory.important_memories];
  for (const item of ownerItems) {
    const { error } = await supabase.from("memory_items").upsert(
      {
        owner_telegram_user_id: config.ownerTelegramId,
        subject_type: "owner",
        subject_key: item.id,
        memory_type: item.type,
        content: item.content,
        summary: item.content,
        visibility: item.visibility,
        allowed_contacts: [],
        source: item.source,
        confidence: item.confidence,
        sensitivity: item.visibility === "owner_only" ? "high" : "low",
        expires_at: item.expires_at ?? null,
        review_required: false
      },
      { onConflict: "subject_type,subject_key" }
    );
    if (error) throw error;
    counts.owner_memories += 1;
  }

  const shareIndex = await readJson<ShareIndexData>("eswar_share_index.json", { indexes: [] });
  for (const index of shareIndex.indexes) {
    const { error } = await supabase.from("eswar_share_index").upsert(index, { onConflict: "key" });
    if (error) throw error;
    counts.share_indexes += 1;
  }

  console.log(JSON.stringify({ status: "ok", migrated: counts }, null, 2));
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else if (error && typeof error === "object") {
    const safe = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error(JSON.stringify({
      message: safe.message,
      code: safe.code,
      details: safe.details,
      hint: safe.hint
    }, null, 2));
  } else {
    console.error(String(error));
  }
  process.exit(1);
});

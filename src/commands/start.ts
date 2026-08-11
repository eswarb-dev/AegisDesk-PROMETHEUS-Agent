import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import { MemoryStore } from "../memory/memoryStore.js";
import { userMemoryStore } from "../memory/userMemoryStore.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import { isOwner } from "../memory/ownerMemory.js";
import { displayName } from "../utils/safeText.js";

export async function startCommand(
  ctx: Context,
  config: Pick<AppConfig, "ownerTelegramId">,
  store: MemoryStore,
  contacts?: TrustedContactService,
  storage?: StorageProvider
): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;
  if (!from || !chat) return;

  const owner = isOwner(from.id, config);
  const stored = store.upsertTelegramUser({
    telegram_user_id: from.id,
    chat_id: chat.id,
    username: from.username,
    display_name: displayName(from.first_name, from.last_name, from.username),
    first_name: from.first_name,
    last_name: from.last_name,
    role: owner ? "owner" : "pending",
    trusted: false
  });
  if (!owner) await contacts?.registerPending(stored);
  if (storage?.kind === "supabase") {
    await storage.users.createOrUpdateTelegramUser({
      telegram_user_id: String(from.id),
      chat_id: String(chat.id),
      username: from.username ?? null,
      display_name: stored.display_name,
      role: owner ? "owner" : "pending",
      contact_id: null,
      approved: owner,
      memory_enabled: true
    });
  } else {
    await userMemoryStore.upsertIdentity({
    telegram_user_id: from.id,
    chat_id: chat.id,
    role: owner ? "owner" : "pending",
    contact_id: null,
    display_name: stored.display_name,
    username: from.username ?? null
    });
  }

  await ctx.reply(
    owner
      ? "PROMETHEUS online.\nPersonalised memory mode active.\nI'm here, Eswar."
      : "PROMETHEUS online.\nThis personalised agent is owner-restricted, but public-safe chat is available.\n\nI may remember short safe summaries of your conversations for continuity. Private owner memory remains restricted."
  );
}

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
  const existingSupabaseUser = storage?.kind === "supabase" ? await storage.users.getTelegramUserById(from.id) : null;
  const existingTrustedContactId = existingSupabaseUser?.role === "trusted_contact" ? existingSupabaseUser.contact_id ?? null : null;
  const stored = store.upsertTelegramUser({
    telegram_user_id: from.id,
    chat_id: chat.id,
    username: from.username,
    display_name: displayName(from.first_name, from.last_name, from.username),
    first_name: from.first_name,
    last_name: from.last_name,
    role: owner ? "owner" : existingTrustedContactId ? "trusted_contact" : "pending",
    trusted: Boolean(existingTrustedContactId)
  });
  if (!owner && !existingTrustedContactId) await contacts?.registerPending(stored);
  if (storage?.kind === "supabase") {
    await storage.users.createOrUpdateTelegramUser({
      telegram_user_id: String(from.id),
      chat_id: String(chat.id),
      username: from.username ?? null,
      display_name: stored.display_name,
      role: owner ? "owner" : existingTrustedContactId ? "trusted_contact" : "pending",
      contact_id: existingTrustedContactId,
      approved: owner || Boolean(existingTrustedContactId),
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

  const trustedStart = [
    "PROMETHEUS online.",
    "Trusted support mode is available for you.",
    "",
    "I can remember short summaries of conversations for continuity.",
    "If you seem emotionally distressed, I may notify Eswar so he can support you.",
    "Private chats outside this bot are not accessible.",
    "",
    "Use /privacy for details or /forgetme to clear stored memory."
  ].join("\n");

  await ctx.reply(
    owner
      ? "PROMETHEUS online.\nPersonalised memory mode active.\nI'm here, Eswar."
      : existingTrustedContactId
        ? trustedStart
      : [
          "PROMETHEUS online.",
          "This personalised agent is owner-restricted, but public-safe chat is available.",
          "",
          "PROMETHEUS may store your conversation with this bot to provide continuity.",
          "The owner may review bot conversation logs for safety and memory management.",
          "Private Telegram chats outside this bot are not accessible.",
          "",
          "Use /privacy for details."
        ].join("\n")
  );
}

import type { Context } from "telegraf";
import { userMemoryStore } from "../memory/userMemoryStore.js";
import type { StorageProvider } from "../storage/storageProvider.js";

export async function forgetmeCommand(ctx: Context, storage?: StorageProvider): Promise<void> {
  if (!ctx.from?.id) return;
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  if (!/CONFIRM FORGETME\b/i.test(text)) {
    await ctx.reply("This will delete your stored PROMETHEUS memory and bot conversation history.\n\nType CONFIRM FORGETME to continue.");
    return;
  }
  if (storage?.kind === "supabase") {
    const existing = await storage.users.getTelegramUserById(ctx.from.id);
    await storage.memories.deleteSelfMemories(ctx.from.id);
    await storage.conversations.deleteForUser(ctx.from.id);
    await storage.messages.deleteUserMessages(ctx.from.id);
    await storage.users.createOrUpdateTelegramUser({
      telegram_user_id: String(ctx.from.id),
      chat_id: String(ctx.chat?.id ?? ctx.from.id),
      username: ctx.from.username ?? null,
      display_name: ctx.from.first_name,
      role: existing?.role ?? "user",
      contact_id: existing?.contact_id ?? null,
      memory_enabled: false,
      approved: existing?.approved ?? false
    });
    await storage.audit.writeAuditLog({
      actor_telegram_user_id: String(ctx.from.id),
      action: "user_memory.forgetme",
      target_table: "memory_items",
      safe_description: "User deleted self memory and conversation summary"
    });
  } else {
    await userMemoryStore.forget(ctx.from.id);
  }
  await ctx.reply("Your stored PROMETHEUS user memory has been deleted.");
}

import type { Context } from "telegraf";
import { userMemoryStore } from "../memory/userMemoryStore.js";
import type { StorageProvider } from "../storage/storageProvider.js";

export async function forgetmeCommand(ctx: Context, storage?: StorageProvider): Promise<void> {
  if (!ctx.from?.id) return;
  if (storage?.kind === "supabase") {
    await storage.memories.deleteSelfMemories(ctx.from.id);
    await storage.conversations.deleteForUser(ctx.from.id);
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

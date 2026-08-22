import type { Context } from "telegraf";
import type { StorageProvider } from "../storage/storageProvider.js";

export async function feedbackCommand(ctx: Context, storage: StorageProvider): Promise<void> {
  if (!ctx.from?.id) return;
  const arg = ((ctx.message as { text?: string } | undefined)?.text ?? "").trim().split(/\s+/)[1]?.toLowerCase();
  if (arg !== "good" && arg !== "bad") {
    await ctx.reply("Use /feedback good or /feedback bad.");
    return;
  }
  if (storage.kind === "supabase") {
    await storage.styles.createLearningEvent({
      telegram_user_id: String(ctx.from.id),
      event_type: "reply_feedback",
      observation: arg === "good" ? "User marked previous reply good." : "User marked previous reply bad.",
      memory_update: { feedback: arg },
      confidence: 1,
      applied: false
    });
  }
  await ctx.reply(arg === "good"
    ? "Noted. I’ll keep that reply style in mind."
    : "Noted. Send the correction after this if you want me to learn the better style.");
}

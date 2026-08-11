import type { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { userMemoryStore } from "../memory/userMemoryStore.js";
import { PrometheusBrain } from "../prometheus/prometheusBrain.js";
import type { StorageProvider } from "../storage/storageProvider.js";

export function registerMessageRouter(bot: Telegraf, brain: PrometheusBrain, storage?: StorageProvider): void {
  bot.on(message("text"), async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    const response = await brain.respond(ctx.from?.id, ctx.message.text);
    await ctx.reply(response);
    if (ctx.from?.id) {
      if (storage?.kind === "supabase") {
        const user = await storage.users.getTelegramUserById(ctx.from.id);
        await storage.conversations.updateConversationSummary({
          telegram_user_id: String(ctx.from.id),
          role: user?.role ?? "user",
          contact_id: user?.contact_id ?? null,
          short_summary: summarizeForStorage(ctx.message.text)
        });
      } else {
        await userMemoryStore.appendSafeSummary(ctx.from.id, ctx.message.text);
      }
    }
  });
}

function summarizeForStorage(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (/password|otp|token|api key|secret|private key|card|payment/i.test(clean)) {
    return "Recent interaction contained sensitive content and was not summarized.";
  }
  return `Last useful interaction summary: ${clean.slice(0, 220)}`;
}

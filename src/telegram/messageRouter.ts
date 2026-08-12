import type { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import type { AppConfig } from "../config.js";
import { answerOwnerLogQuestion } from "../commands/adminLogs.js";
import { userMemoryStore } from "../memory/userMemoryStore.js";
import { PrometheusBrain } from "../prometheus/prometheusBrain.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import { TrustedSupportService } from "../support/trustedSupportService.js";

export function registerMessageRouter(
  bot: Telegraf,
  brain: PrometheusBrain,
  storage: StorageProvider | undefined,
  config: Pick<AppConfig, "ownerTelegramId" | "groqApiKey" | "groqModel">
): void {
  bot.on(message("text"), async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    if (storage && await answerOwnerLogQuestion(ctx.message.text, ctx, config, storage)) return;
    if (storage?.kind === "supabase" && ctx.from?.id && ctx.chat?.id) {
      const user = await storage.users.getTelegramUserById(ctx.from.id);
      if (user?.role === "trusted_contact" && user.contact_id && user.memory_enabled !== false && isTrustedSupportIntent(ctx.message.text)) {
        const support = new TrustedSupportService(config, storage);
        const response = await support.handleMessage({
          contact: {
            contactId: user.contact_id,
            telegramUserId: String(ctx.from.id),
            chatId: String(ctx.chat.id),
            displayName: user.display_name ?? user.contact_id
          },
          text: ctx.message.text,
          telegram: ctx.telegram
        });
        await ctx.reply(response);
        return;
      }
    }
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

function isTrustedSupportIntent(text: string): boolean {
  return /\b(i feel|feel low|not okay|not ok|sad|alone|lonely|tired of|can't handle|cant handle|panic|broken|nobody cares|tell eswar|alert eswar|notify eswar|message eswar)\b/i.test(text);
}

function summarizeForStorage(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (/password|otp|token|api key|secret|private key|card|payment/i.test(clean)) {
    return "Recent interaction contained sensitive content and was not summarized.";
  }
  return `Last useful interaction summary: ${clean.slice(0, 220)}`;
}

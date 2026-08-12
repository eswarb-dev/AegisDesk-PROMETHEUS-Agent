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
      if (user?.role === "trusted_contact" && user.contact_id && user.memory_enabled !== false && await shouldUseTrustedSupport(storage, user.contact_id, ctx.message.text)) {
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

async function shouldUseTrustedSupport(storage: Extract<StorageProvider, { kind: "supabase" }>, contactId: string, text: string): Promise<boolean> {
  if (isTrustedSupportIntent(text)) return true;
  if (contactId === "aksharaa" && isAksharaaSupportTopic(text)) return true;
  if (contactId !== "vathanya") return false;
  const recent = await storage.support.getRecentEventsForContact(contactId, 3).catch(() => []);
  return recent.some((event) => event.emotional_state !== "neutral" || event.severity !== "low") && isVathanyaSupportFollowUp(text);
}

function isTrustedSupportIntent(text: string): boolean {
  return /\b(i feel|feel low|not okay|not ok|sad|alone|lonely|tired of|can't handle|cant handle|panic|broken|nobody cares|tell eswar|alert eswar|notify eswar|message eswar|depress(?:ed|ion)?|mental health|empty|worthless|crying|cry|overthinking|anxiety|anxious|people leave|everyone leaves|left me|changes|attached|attachment|i'?m fine|nothing is wrong|left on seen|seen status|dry reply|missed call|placement|placements|coding|future|boyfriend|crush)\b/i.test(text);
}

function isVathanyaSupportFollowUp(text: string): boolean {
  return /\b(why|how|again|still|same|it hurts|hurts|what should i do|don'?t know|confused|okay|fine|nothing|people|relationship|change|changed|leaving|left|close|attached|miss|feel|feeling)\b/i.test(text);
}

function isAksharaaSupportTopic(text: string): boolean {
  return /\b(boyfriend|crush|he loves me|he'?ll accept|seen|left on seen|dry reply|one word reply|dp|story|reel|song|online status|missed call|placement|placements|coding|future|trust|hope|relationship|commit|commitment)\b/i.test(text);
}

function summarizeForStorage(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (/password|otp|token|api key|secret|private key|card|payment/i.test(clean)) {
    return "Recent interaction contained sensitive content and was not summarized.";
  }
  return `Last useful interaction summary: ${clean.slice(0, 220)}`;
}

import type { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import type { AppConfig } from "../config.js";
import { defaultCodingConfig } from "../config.js";
import { answerOwnerLogQuestion } from "../commands/adminLogs.js";
import { handleMailDraftConfirmation } from "../commands/mail.js";
import { CodeResponsePlanner } from "../coding/codeResponsePlanner.js";
import { solvePendingCodingRequest } from "../coding/codeResponsePlanner.js";
import { detectCodingIntent } from "../coding/codingIntentDetector.js";
import { splitTelegramMarkdown } from "../coding/codeBlockFormatter.js";
import { normalizeCodeLanguage } from "../coding/languageResolver.js";
import { userMemoryStore } from "../memory/userMemoryStore.js";
import { PrometheusBrain } from "../prometheus/prometheusBrain.js";
import { GroqClient } from "../prometheus/groqClient.js";
import { prometheusCore } from "../prometheus/core/prometheusCore.js";
import { shouldRejectSecret } from "../prometheus/core/memoryReflectionEngine.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import { TrustedSupportService } from "../support/trustedSupportService.js";
import { formatContactDisplayName, getRecentOwnerSupportAlert, isOwnerAlertFollowup } from "../support/ownerAlertContext.js";
import { isOwner } from "../memory/ownerMemory.js";
import { logger } from "../utils/logger.js";

export function registerMessageRouter(
  bot: Telegraf,
  brain: PrometheusBrain,
  storage: StorageProvider | undefined,
  config: AppConfig
): void {
  bot.on(message("text"), async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    if (storage && await handleMailDraftConfirmation(ctx, config, storage)) return;
    if (isOwner(ctx.from?.id, config) && isOwnerAlertFollowup(ctx.message.text)) {
      const alert = getRecentOwnerSupportAlert();
      if (alert) {
        await ctx.reply(`That was ${formatContactDisplayName(alert.contactId)}, Sir.`);
        return;
      }
    }
    if (storage && isShortOwnerLogQuestion(ctx.message.text) && await answerOwnerLogQuestion(ctx.message.text, ctx, config, storage)) return;
    const coding = config.coding ?? defaultCodingConfig();
    const followUpLanguage = normalizeCodeLanguage(ctx.message.text);
    if (coding.enabled && followUpLanguage && ctx.from?.id && ctx.chat?.id) {
      const planner = new CodeResponsePlanner(config, new GroqClient({
        ...config,
        groqModelPrimary: coding.codeModel ?? config.groqModelPrimary ?? config.groqModel,
        groqModelFallback: coding.codeModelFallback ?? config.groqModelFallback
      }), storage);
      const response = await solvePendingCodingRequest({
        userId: ctx.from.id,
        chatId: ctx.chat.id,
        language: followUpLanguage,
        planner
      });
      if (response) {
        for (const part of splitTelegramMarkdown(response)) await ctx.reply(part);
        return;
      }
    }
    if (coding.enabled && detectCodingIntent(ctx.message.text).isCodingRequest) {
      const planner = new CodeResponsePlanner(config, new GroqClient({
        ...config,
        groqModelPrimary: coding.codeModel ?? config.groqModelPrimary ?? config.groqModel,
        groqModelFallback: coding.codeModelFallback ?? config.groqModelFallback
      }), storage);
      const response = await planner.solve({ userId: ctx.from?.id, text: ctx.message.text });
      for (const part of splitTelegramMarkdown(response)) await ctx.reply(part);
      return;
    }
    if (storage?.kind === "supabase" && ctx.from?.id && ctx.chat?.id) {
      const user = await storage.users.getTelegramUserById(ctx.from.id);
      if (user?.role === "trusted_contact" && user.contact_id && user.memory_enabled !== false && await shouldUseTrustedSupport(storage, user.contact_id, String(ctx.from.id), ctx.message.text)) {
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
    const response = await brain.respond(ctx.from?.id, ctx.message.text, { telegramMessageId: ctx.message.message_id });
    if (process.env.NODE_ENV === "development") logger.info("normal_reply_generated", { role: isOwner(ctx.from?.id, config) ? "owner" : "non_owner" });
    await ctx.reply(response);
    if (process.env.NODE_ENV === "development") logger.info("normal_reply_sent", { role: isOwner(ctx.from?.id, config) ? "owner" : "non_owner" });
    if (ctx.from?.id) {
      if (storage?.kind === "supabase") {
        const user = await storage.users.getTelegramUserById(ctx.from.id);
        await storage.conversations.updateConversationSummary({
          telegram_user_id: String(ctx.from.id),
          role: user?.role ?? "user",
          contact_id: user?.contact_id ?? null,
          short_summary: summarizeForStorage(ctx.message.text)
        });
        await reflectAdaptiveLearning(storage, String(ctx.from.id), user?.role ?? "user", user?.contact_id ?? null, ctx.message.text);
      } else {
        await userMemoryStore.appendSafeSummary(ctx.from.id, ctx.message.text);
      }
    }
  });
}

async function reflectAdaptiveLearning(
  storage: Extract<StorageProvider, { kind: "supabase" }>,
  telegramUserId: string,
  role: "owner" | "trusted_contact" | "user" | "pending",
  contactId: string | null,
  text: string
): Promise<void> {
  try {
    const existing = await storage.styles.getProfile(telegramUserId).catch(() => null);
    if (existing?.learning_enabled === false || shouldRejectSecret(text)) return;
    const decision = prometheusCore.decide({ role, text, style: existing });
    if (!decision.learningEvent) return;
    const event = await storage.styles.createLearningEvent({
      telegram_user_id: telegramUserId,
      event_type: decision.learningEvent.eventType,
      observation: decision.learningEvent.observation,
      memory_update: decision.learningEvent.memoryUpdate,
      confidence: decision.learningEvent.confidence,
      applied: decision.learningEvent.confidence >= 0.7
    });
    if (decision.learningEvent.confidence >= 0.7) {
      await storage.styles.upsertProfile({
        telegram_user_id: telegramUserId,
        role,
        contact_id: contactId,
        slang_terms: decision.styleSignal.slangTerms,
        emoji_preference: decision.styleSignal.emojiPreference,
        preferred_reply_length: decision.styleSignal.preferredReplyLength,
        preferred_tone: decision.styleSignal.preferredTone,
        dislikes: decision.styleSignal.dislikes,
        repeated_topics: decision.emotion.needsSupport ? [decision.emotion.state] : [],
        emotional_support_style: decision.emotion.needsSupport ? "validate_first_then_practical" : undefined,
        confidence: decision.learningEvent.confidence
      });
    }
    logger.info("learning_event_recorded", { event_type: event.event_type, applied: event.applied });
  } catch {
    logger.warn("learning_reflection_failed", { error_type: "storage_write_failed" });
  }
}

async function shouldUseTrustedSupport(storage: Extract<StorageProvider, { kind: "supabase" }>, contactId: string, telegramUserId: string, text: string): Promise<boolean> {
  if (await isContextualReplyToOwnerRelay(storage, contactId, telegramUserId, text)) return false;
  if (isTrustedSupportIntent(text)) return true;
  if (contactId === "aksharaa" && isAksharaaSupportTopic(text)) return true;
  if (contactId !== "vathanya") return false;
  const recent = await storage.support.getRecentEventsForContact(contactId, 3).catch(() => []);
  return recent.some((event) => event.emotional_state !== "neutral" || event.severity !== "low") && isVathanyaSupportFollowUp(text);
}

async function isContextualReplyToOwnerRelay(storage: Extract<StorageProvider, { kind: "supabase" }>, contactId: string, telegramUserId: string, text: string): Promise<boolean> {
  if (!isShortReactionToContext(text)) return false;
  const messages = await storage.messages.getMessagesByContactId(contactId, telegramUserId, 10).catch(() => []);
  const previous = [...messages].reverse().find((message) => message.direction === "outbound");
  if (!previous?.owner_initiated) return false;
  if (previous.contact_id !== contactId) return false;
  const contextText = `${previous.text_redacted ?? previous.text ?? ""} ${previous.source_command ?? ""}`.toLowerCase();
  return previous.message_type === "owner_relay" || previous.sender_label === "owner_via_prometheus" || /\b(tell|send_message|birthday|bday|😂|haha|caught|plan)\b/.test(contextText);
}

function isShortReactionToContext(text: string): boolean {
  const clean = text.trim().toLowerCase();
  if (!clean) return false;
  if (/^(😭+|😂+|🤣+|🥲+|😅+|😢+|😌+|👍+|❤️+|💀+|ok+|okay|okie|seri|hmm+|oh+h+|ayyoo+|by mistake+|by mistake\.*|mistake\.*)$/iu.test(clean)) return true;
  return clean.length <= 24 && /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s.!?]+$/u.test(clean);
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

function isShortOwnerLogQuestion(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length > 18) return false;
  return /\b(who messaged you today|summari[sz]e today|did|has|have|does|what|show|list|check)\b/i.test(text);
}
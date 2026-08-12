import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isAllowedContactId, TrustedContactService } from "../contacts/trustedContactService.js";
import { isOwner } from "../memory/ownerMemory.js";
import type { StorageProvider } from "../storage/storageProvider.js";

export async function tellCommand(
  ctx: Context,
  config: Pick<AppConfig, "ownerTelegramId">,
  service: TrustedContactService,
  storage?: StorageProvider
): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("PROMETHEUS is active.\nThis command is owner-restricted.");
    return;
  }
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  const match = text.match(/^\/(?:tell|send_message|send)\s+(\S+)\s+([\s\S]+)/i);
  const contactId = match?.[1]?.trim().toLowerCase();
  if (!match || !contactId || !isAllowedContactId(contactId)) {
    await ctx.reply("Usage: /tell <aksharaa|vathanya|maddhurika> <message>\nAlias: /send_message <contact_id> <message>");
    return;
  }
  const ownerMessage = match[2].trim();
  if (!ownerMessage || isUnsafeMessage(ownerMessage)) {
    await ctx.reply("Message not sent.\nReason: unsafe content.");
    return;
  }
  const message = ["Hey 👋", "", ownerMessage, "", "— PROMETHEUS"].join("\n");
  try {
    if (storage?.kind === "supabase") {
      await sendViaSupabaseContact(ctx, storage, contactId, message);
    } else {
      await service.sendMessage(ctx.telegram, contactId, message);
    }
    await ctx.reply(`Sent to ${titleCase(contactId)} ✅`);
  } catch (error) {
    await ctx.reply(formatTellError(contactId, error));
  }
}

async function sendViaSupabaseContact(ctx: Context, storage: Extract<StorageProvider, { kind: "supabase" }>, contactId: "aksharaa" | "vathanya" | "maddhurika", message: string): Promise<void> {
  const contact = await storage.contacts.repairChatIdFromTelegramUser(contactId);
  if (!contact?.enabled || !contact.telegram_user_id) {
    throw new Error(`${titleCase(contactId)} is not linked as an approved trusted contact.`);
  }
  if (contact.chat_id == null) {
    throw new Error(`${titleCase(contactId)} is linked by Telegram ID, but chat_id is missing.\nAsk them to send /start to PROMETHEUS again, then retry.`);
  }
  await ctx.telegram.sendMessage(contact.chat_id, message);
  await storage.messages.storeOutboundMessage({
    telegram_user_id: String(contact.telegram_user_id),
    chat_id: String(contact.chat_id),
    role: "trusted_contact",
    contact_id: contactId,
    message_type: "admin",
    text: message
  });
}

function formatTellError(contactId: string, error: unknown): string {
  const response = (error as { response?: { error_code?: number; description?: string } } | undefined)?.response;
  const description = response?.description ?? (error instanceof Error ? error.message : "");
  if (response?.error_code === 403 || /blocked|bot was blocked|forbidden/i.test(description)) {
    return `Cannot message ${titleCase(contactId)} yet.\nReason: they have not started PROMETHEUS or blocked the bot.\nAsk them to open @AegisDesk_PrometheusBot and send /start.`;
  }
  if (response?.error_code === 400 || /chat not found|chat_id|invalid/i.test(description)) {
    return `Cannot message ${titleCase(contactId)}.\nReason: chat_id is missing/invalid.\nAsk them to send /start again.`;
  }
  return description || "Unable to send message.";
}

function isUnsafeMessage(text: string): boolean {
  return /\b(kill yourself|self-harm instructions|doxx|leak password)\b/i.test(text);
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

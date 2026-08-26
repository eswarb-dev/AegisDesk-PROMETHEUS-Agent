import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isAllowedContactId, TrustedContactService } from "../contacts/trustedContactService.js";
import { TrustedContactMessagingService, type OwnerRelayCommand } from "../contacts/trustedContactMessagingService.js";
import type { ContactId } from "../contacts/trustedContactTypes.js";
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
  const sourceCommand = parseSourceCommand(text);
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
      const relay = new TrustedContactMessagingService(storage);
      await relay.sendOwnerMessageToContact({ ctx, contactId: contactId as ContactId, message, sourceCommand });
    } else {
      await service.sendMessage(ctx.telegram, contactId, message);
    }
    await ctx.reply(`Sent to ${titleCase(contactId)} ✅`);
  } catch (error) {
    await ctx.reply(formatTellError(contactId, error));
  }
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

function parseSourceCommand(text: string): OwnerRelayCommand {
  const command = text.trim().split(/\s+/, 1)[0]?.replace("/", "").toLowerCase();
  return command === "send_message" || command === "send" ? command : "tell";
}

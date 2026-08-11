import type { Context, MiddlewareFn } from "telegraf";
import type { AppConfig } from "../config.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import { isOwner } from "../memory/ownerMemory.js";
import type { BotMessageType } from "../storage/messageRepository.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import { displayName } from "../utils/safeText.js";

export function createMessageLoggingMiddleware(
  config: Pick<AppConfig, "ownerTelegramId">,
  contacts: TrustedContactService,
  storage: StorageProvider
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (storage.kind !== "supabase" || !ctx.from || !ctx.chat) {
      await next();
      return;
    }

    const identity = await contacts.resolveRole(ctx.from.id);
    const role = isOwner(ctx.from.id, config) ? "owner" : identity.role;
    const contactId = identity.contact?.id ?? null;
    const memoryEnabled = await storage.users.getTelegramUserById(ctx.from.id).then((user) => user?.memory_enabled ?? true);

    await storage.users.createOrUpdateTelegramUser({
      telegram_user_id: String(ctx.from.id),
      chat_id: String(ctx.chat.id),
      username: ctx.from.username ?? null,
      display_name: displayName(ctx.from.first_name, ctx.from.last_name, ctx.from.username),
      role,
      contact_id: contactId,
      approved: role === "owner" || role === "trusted_contact",
      memory_enabled: memoryEnabled
    });

    const text = getText(ctx);
    if (text && memoryEnabled) {
      await storage.messages.storeInboundMessage({
        telegram_user_id: String(ctx.from.id),
        chat_id: String(ctx.chat.id),
        role,
        contact_id: contactId,
        message_type: text.startsWith("/") ? "command" : "text",
        command: text.startsWith("/") ? text.split(/\s+/)[0] : null,
        text
      });
    }

    const originalReply = ctx.reply.bind(ctx);
    ctx.reply = (async (text: string, ...args: unknown[]) => {
      if (memoryEnabled) {
        await storage.messages.storeOutboundMessage({
          telegram_user_id: String(ctx.from?.id ?? ""),
          chat_id: String(ctx.chat?.id ?? ""),
          role,
          contact_id: contactId,
          message_type: getOutboundType(text),
          text
        });
      }
      return originalReply(text, ...(args as []));
    }) as typeof ctx.reply;

    await next();
  };
}

function getText(ctx: Context): string | null {
  const message = ctx.message as { text?: string } | undefined;
  return message?.text ?? null;
}

function getOutboundType(text: string): BotMessageType {
  if (/owner-restricted|admin|logs|export|audit/i.test(text)) return "admin";
  if (/fallback|API|not allowed|cannot share/i.test(text)) return "fallback";
  return "text";
}

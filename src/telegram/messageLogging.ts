import type { Context, MiddlewareFn } from "telegraf";
import type { AppConfig } from "../config.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import { isOwner } from "../memory/ownerMemory.js";
import type { BotMessageType } from "../storage/messageRepository.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import { logger } from "../utils/logger.js";
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

    const identity = await resolveLoggingIdentity(ctx.from.id, config, contacts, storage);
    const role = identity.role;
    const contactId = identity.contactId;
    const memoryEnabled = await storage.users.getTelegramUserById(ctx.from.id).then((user) => user?.memory_enabled ?? true).catch(() => true);

    await safeLogWrite(async () => {
      await storage.users.createOrUpdateTelegramUser({
        telegram_user_id: String(ctx.from?.id ?? ""),
        chat_id: String(ctx.chat?.id ?? ""),
        username: ctx.from?.username ?? null,
        display_name: displayName(ctx.from?.first_name, ctx.from?.last_name, ctx.from?.username),
        role,
        contact_id: contactId,
        approved: role === "owner" || role === "trusted_contact",
        memory_enabled: memoryEnabled
      });
    });

    const text = getText(ctx);
    if (text && memoryEnabled) {
      await safeLogWrite(async () => {
        await storage.messages.storeInboundMessage({
          telegram_user_id: String(ctx.from?.id ?? ""),
          chat_id: String(ctx.chat?.id ?? ""),
          role,
          contact_id: contactId,
          message_type: text.startsWith("/") ? "command" : "text",
          command: text.startsWith("/") ? text.split(/\s+/)[0] : null,
          text
        });
      });
    }

    const originalReply = ctx.reply.bind(ctx);
    ctx.reply = (async (text: string, ...args: unknown[]) => {
      if (memoryEnabled) {
        await safeLogWrite(async () => {
          await storage.messages.storeOutboundMessage({
            telegram_user_id: String(ctx.from?.id ?? ""),
            chat_id: String(ctx.chat?.id ?? ""),
            role,
            contact_id: contactId,
            message_type: getOutboundType(text),
            text
          });
        });
      }
      return originalReply(text, ...(args as []));
    }) as typeof ctx.reply;

    await next();
  };
}

async function resolveLoggingIdentity(
  userId: number,
  config: Pick<AppConfig, "ownerTelegramId">,
  contacts: TrustedContactService,
  storage: StorageProvider
): Promise<{ role: "owner" | "trusted_contact" | "user" | "pending"; contactId: string | null }> {
  if (isOwner(userId, config)) return { role: "owner", contactId: null };
  if (storage.kind === "supabase") {
    const user = await storage.users.getTelegramUserById(userId).catch(() => null);
    if (user?.role === "trusted_contact" && user.contact_id) return { role: "trusted_contact", contactId: user.contact_id };
    const contact = await storage.contacts.findEnabledByTelegramId(userId).catch(() => undefined);
    if (contact) return { role: "trusted_contact", contactId: contact.id };
    return { role: user?.role ?? "user", contactId: user?.contact_id ?? null };
  }
  const identity = await contacts.resolveRole(userId);
  return { role: identity.role, contactId: identity.contact?.id ?? null };
}

async function safeLogWrite(write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch {
    logger.warn("bot_message_logging_failed", { error_type: "storage_write_failed" });
  }
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

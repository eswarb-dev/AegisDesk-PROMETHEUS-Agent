import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isAllowedContactId, TrustedContactService } from "../contacts/trustedContactService.js";
import { isOwner } from "../memory/ownerMemory.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import { registerTrustedContactCommands } from "../telegram/commandMenu.js";

export async function trustCommand(
  ctx: Context,
  config: Pick<AppConfig, "ownerTelegramId">,
  service: TrustedContactService,
  storage?: StorageProvider
): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("Owner-only command.");
    return;
  }
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  const parts = text.trim().split(/\s+/);
  const replace = parts[1] === "--replace";
  const userIdText = replace ? parts[2] : parts[1];
  const contactId = replace ? parts[3] : parts[2];
  const telegramUserId = Number(userIdText);
  if (!Number.isInteger(telegramUserId) || !isAllowedContactId(contactId)) {
    await ctx.reply("Usage: /trust <telegram_user_id> <aksharaa|vathanya|maddhurika>");
    return;
  }

  try {
    const existingContact = storage?.kind === "supabase" ? await storage.contacts.findByContactId(contactId) : undefined;
    const wasAlreadyLinked = existingContact?.telegram_user_id === telegramUserId && existingContact.enabled;
    const contact = storage?.kind === "supabase"
      ? await storage.contacts.link(telegramUserId, contactId, replace)
      : await service.approve(telegramUserId, contactId);
    if (storage?.kind === "supabase") {
      await storage.audit.writeAuditLog({
        actor_telegram_user_id: String(ctx.from?.id ?? ""),
        action: "trusted_contact.approve",
        target_table: "trusted_contacts",
        target_id: contact.id,
        safe_description: `Approved trusted contact ${contact.id}`
      });
    }
    if (contact.chat_id != null) {
      await registerTrustedContactCommands(ctx.telegram, contact.chat_id);
    }
    await ctx.reply(
      [
        wasAlreadyLinked ? `✅ ${contact.name} is already linked` : "✅ Trusted contact approved",
        "",
        `Name: ${contact.name}`,
        "Role: trusted_contact",
        "Trusted memory access: enabled",
        "Owner-only memory access: denied",
        contact.chat_id != null ? "Telegram menu: trusted-contact commands updated" : "Telegram menu: ask them to send /start if the menu does not update"
      ].join("\n")
    );
  } catch (error) {
    await ctx.reply(error instanceof Error ? error.message : "Unable to approve trusted contact.");
  }
}

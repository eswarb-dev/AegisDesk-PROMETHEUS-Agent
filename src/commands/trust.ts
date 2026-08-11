import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isAllowedContactId, TrustedContactService } from "../contacts/trustedContactService.js";
import { isOwner } from "../memory/ownerMemory.js";

export async function trustCommand(
  ctx: Context,
  config: Pick<AppConfig, "ownerTelegramId">,
  service: TrustedContactService
): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("Owner-only command.");
    return;
  }
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  const [, userIdText, contactId] = text.trim().split(/\s+/);
  const telegramUserId = Number(userIdText);
  if (!Number.isInteger(telegramUserId) || !isAllowedContactId(contactId)) {
    await ctx.reply("Usage: /trust <telegram_user_id> <aksharaa|vathanya|maddhurika>");
    return;
  }

  try {
    const contact = await service.approve(telegramUserId, contactId);
    await ctx.reply(
      [
        "✅ Trusted contact approved",
        "",
        `Name: ${contact.name}`,
        "Role: trusted_contact",
        "Trusted memory access: enabled",
        "Owner-only memory access: denied"
      ].join("\n")
    );
  } catch (error) {
    await ctx.reply(error instanceof Error ? error.message : "Unable to approve trusted contact.");
  }
}

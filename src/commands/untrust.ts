import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isAllowedContactId, TrustedContactService } from "../contacts/trustedContactService.js";
import { isOwner } from "../memory/ownerMemory.js";

export async function untrustCommand(
  ctx: Context,
  config: Pick<AppConfig, "ownerTelegramId">,
  service: TrustedContactService
): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("Owner-only command.");
    return;
  }
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  const contactId = text.trim().split(/\s+/)[1];
  if (!isAllowedContactId(contactId)) {
    await ctx.reply("Usage: /untrust <aksharaa|vathanya|maddhurika>");
    return;
  }
  const contact = await service.revoke(contactId);
  await ctx.reply(`Trusted access revoked for ${contact.name}.`);
}

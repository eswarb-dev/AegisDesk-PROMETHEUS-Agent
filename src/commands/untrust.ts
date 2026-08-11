import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isAllowedContactId, TrustedContactService } from "../contacts/trustedContactService.js";
import { isOwner } from "../memory/ownerMemory.js";
import type { StorageProvider } from "../storage/storageProvider.js";

export async function untrustCommand(
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
  const contactId = text.trim().split(/\s+/)[1];
  if (!isAllowedContactId(contactId)) {
    await ctx.reply("Usage: /untrust <aksharaa|vathanya|maddhurika>");
    return;
  }
  const contact = storage?.kind === "supabase" ? await storage.contacts.revoke(contactId) : await service.revoke(contactId);
  if (storage?.kind === "supabase") {
    await storage.audit.writeAuditLog({
      actor_telegram_user_id: String(ctx.from?.id ?? ""),
      action: "trusted_contact.revoke",
      target_table: "trusted_contacts",
      target_id: contact.id,
      safe_description: `Revoked trusted contact ${contact.id}`
    });
  }
  await ctx.reply(`Trusted access revoked for ${contact.name}.`);
}

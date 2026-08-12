import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { resolveActor } from "../auth/ownerResolver.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import { displayName } from "../utils/safeText.js";

export async function whoamiCommand(
  ctx: Context,
  service: TrustedContactService,
  config: Pick<AppConfig, "ownerTelegramId">,
  storage?: StorageProvider
): Promise<void> {
  const actor = await resolveActor(ctx, config, storage);
  const identity = actor.isOwner
    ? { role: "owner" }
    : storage?.kind === "supabase" && ctx.from?.id
      ? await resolveSupabaseWhoamiRole(ctx.from.id, storage)
      : await service.resolveRole(ctx.from?.id);
  const from = ctx.from;
  const chat = ctx.chat;
  const ownerMatch = Boolean(from?.id && String(from.id) === String(config.ownerTelegramId));
  const safeIdentity = [
    `Telegram ID: ${from?.id ?? "unknown"}`,
    `Chat ID: ${chat?.id ?? "unknown"}`,
    `Username: ${from?.username ? `@${from.username}` : "not available"}`,
    `Name: ${displayName(from?.first_name, from?.last_name, from?.username)}`
  ];

  if (identity.role === "owner") {
    await ctx.reply([...safeIdentity, `Owner match: ${ownerMatch}`, "", "Role: owner", "Identity: Creator", "Address: Sir", "Personalised memory: full access"].join("\n"));
    return;
  }
  if (identity.role === "trusted_contact") {
    await ctx.reply([...safeIdentity, "", "Trust worthy person to My Master Eswar", "Role: trusted_contact", "Filtered owner memory: available", "Raw private logs: restricted"].join("\n"));
    return;
  }
  await ctx.reply([...safeIdentity, `Owner match: ${ownerMatch}`, "", "Role: user", "Personalised memory: restricted"].join("\n"));
}

async function resolveSupabaseWhoamiRole(userId: string | number, storage: StorageProvider): Promise<{ role: string; contactId?: string | null }> {
  if (storage.kind !== "supabase") return { role: "user" };
  const user = await storage.users.getTelegramUserById(userId);
  if (user?.role === "trusted_contact") return { role: "trusted_contact", contactId: user.contact_id };
  const contact = await storage.contacts.findEnabledByTelegramId(userId);
  if (contact) return { role: "trusted_contact", contactId: contact.id };
  return { role: user?.role ?? "user" };
}

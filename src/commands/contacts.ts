import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import { isOwner } from "../memory/ownerMemory.js";
import type { StorageProvider } from "../storage/storageProvider.js";

function usernameText(username?: string | null): string {
  return username ? `@${username}` : "not available";
}

export async function contactsCommand(
  ctx: Context,
  config: Pick<AppConfig, "ownerTelegramId">,
  service: TrustedContactService,
  storage?: StorageProvider
): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("Owner-only command.");
    return;
  }

  const data = storage?.kind === "supabase" ? await storage.contacts.list() : await service.list();
  const trusted = data.trusted_contacts.map((contact, index) => {
    const status = contact.enabled ? "✅" : "⏳ Not linked";
    const id = contact.telegram_user_id ?? "not linked";
    return `${index + 1}. ${contact.name} ${status}\n   Telegram: ${usernameText(contact.username)}\n   ID: ${id}`;
  });
  const pending = data.pending_users.length
    ? data.pending_users.map((user) => `${usernameText(user.username)}\nID: ${user.telegram_user_id}\nName: ${user.display_name}`)
    : ["None"];

  await ctx.reply(["Trusted Contacts", "", ...trusted, "", "Pending Users", "", ...pending].join("\n"));
}

import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isAllowedContactId } from "../contacts/trustedContactService.js";
import { isOwner } from "../memory/ownerMemory.js";
import { shareIndexStore } from "../memory/shareIndexStore.js";

export async function stateCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("Owner-only command.");
    return;
  }
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  const setMatch = text.match(/^\/state\s+set\s+([\s\S]+)/);
  if (setMatch) {
    const item = await shareIndexStore.addState(setMatch[1].trim());
    await ctx.reply(`State memory created.\nKey: ${item.key}\nExpires: ${item.expires_at}`);
    return;
  }
  const shareMatch = text.match(/^\/state\s+share\s+(\S+)\s+(\S+)/);
  if (shareMatch) {
    const contactId = shareMatch[1];
    if (contactId !== "all" && !isAllowedContactId(contactId)) {
      await ctx.reply("Usage: /state share <aksharaa|vathanya|maddhurika|all> <key>");
      return;
    }
    const item = await shareIndexStore.share(shareMatch[2], contactId);
    await ctx.reply(`State shared.\nKey: ${item.key}\nAllowed: ${item.allowed_contacts.join(", ")}`);
    return;
  }
  await ctx.reply("Usage:\n/state set <summary>\n/state share <contact_id|all> <key>");
}

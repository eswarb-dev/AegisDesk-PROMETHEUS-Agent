import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isAllowedContactId, TrustedContactService } from "../contacts/trustedContactService.js";
import { isOwner } from "../memory/ownerMemory.js";

export async function tellCommand(
  ctx: Context,
  config: Pick<AppConfig, "ownerTelegramId">,
  service: TrustedContactService
): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("Owner-only command.");
    return;
  }
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  const match = text.match(/^\/tell\s+(\S+)\s+([\s\S]+)/);
  if (!match || !isAllowedContactId(match[1])) {
    await ctx.reply("Usage: /tell <aksharaa|vathanya|maddhurika> <message>");
    return;
  }
  const message = ["Hey 👋", "", match[2].trim(), "", "— PROMETHEUS"].join("\n");
  try {
    await service.sendMessage(ctx.telegram, match[1], message);
    await ctx.reply("Message sent.");
  } catch (error) {
    await ctx.reply(error instanceof Error ? error.message : "Unable to send message.");
  }
}

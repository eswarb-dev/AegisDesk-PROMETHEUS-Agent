import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isOwner } from "../memory/ownerMemory.js";

export async function adminCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("PROMETHEUS is active.\nThis command is owner-restricted.");
    return;
  }
  await ctx.reply([
    "PROMETHEUS Owner Admin",
    "",
    "Logs:",
    "/users",
    "/logs",
    "/logs <contact_id>",
    "/chat <contact_id>",
    "/chat <contact_id> <limit>",
    "/search <contact_id> <query>",
    "/summary <contact_id>",
    "/export <contact_id>",
    "/audit",
    "",
    "Memory:",
    "/memory",
    "/memory summary",
    "/memory reload",
    "/memory user <contact_id>",
    "/shareindex",
    "/state",
    "",
    "Contacts:",
    "/contacts",
    "/trust <telegram_user_id> <contact_id>",
    "/untrust <contact_id>",
    "/tell <contact_id> <message>",
    "",
    "Support:",
    "/support",
    "/support <contact_id>",
    "/support alerts",
    "/support settings"
  ].join("\n"));
}

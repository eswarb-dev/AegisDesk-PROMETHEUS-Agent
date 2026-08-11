import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import { displayName } from "../utils/safeText.js";

export async function whoamiCommand(
  ctx: Context,
  service: TrustedContactService,
  config: Pick<AppConfig, "ownerTelegramId">
): Promise<void> {
  const identity = await service.resolveRole(ctx.from?.id);
  const from = ctx.from;
  const chat = ctx.chat;
  const ownerMatch = Boolean(from?.id && String(from.id) === String(config.ownerTelegramId));
  const safeIdentity = [
    `Telegram ID: ${from?.id ?? "unknown"}`,
    `Chat ID: ${chat?.id ?? "unknown"}`,
    `Username: ${from?.username ? `@${from.username}` : "not available"}`,
    `Name: ${displayName(from?.first_name, from?.last_name, from?.username)}`,
    `Owner match: ${ownerMatch}`
  ];

  if (identity.role === "owner") {
    await ctx.reply([...safeIdentity, "", "Role: owner", "Personalised memory: full access"].join("\n"));
    return;
  }
  if (identity.role === "trusted_contact") {
    await ctx.reply([...safeIdentity, "", "Role: trusted_contact", "Trusted memory: available", "Private owner memory: restricted"].join("\n"));
    return;
  }
  await ctx.reply([...safeIdentity, "", "Role: user", "Personalised memory: restricted"].join("\n"));
}

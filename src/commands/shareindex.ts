import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isOwner } from "../memory/ownerMemory.js";
import { shareIndexStore } from "../memory/shareIndexStore.js";

export async function shareindexCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("Owner-only command.");
    return;
  }
  const indexes = (await shareIndexStore.load()).indexes;
  await ctx.reply(
    [
      "Eswar Share Index",
      "",
      ...(indexes.length
        ? indexes.map((item) => `${item.key}\nVisibility: ${item.visibility}\nAllowed: ${item.allowed_contacts.join(", ") || "public/all"}\nExpires: ${item.expires_at ?? "never"}`)
        : ["No share indexes stored."])
    ].join("\n\n")
  );
}

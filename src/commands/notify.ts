import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isOwner } from "../memory/ownerMemory.js";
import type { StorageProvider } from "../storage/storageProvider.js";

const OWNER_RESTRICTED = "PROMETHEUS is active.\nNotify is owner-restricted.";

export async function notifyCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, storage: StorageProvider): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply(OWNER_RESTRICTED);
    return;
  }
  if (storage.kind !== "supabase") {
    await ctx.reply("Notify requires Supabase user storage, Sir.");
    return;
  }
  const message = getMessage(ctx);
  if (!message) {
    await ctx.reply("Usage: /notify <message>");
    return;
  }

  const recipients = await storage.users.listBroadcastRecipients();
  const uniqueChatIds = [...new Set(recipients.map((user) => user.chat_id).filter((chatId): chatId is string => Boolean(chatId)))];
  let sent = 0;
  let failed = 0;
  for (const chatId of uniqueChatIds) {
    try {
      await ctx.telegram.sendMessage(chatId, message);
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  await storage.audit.writeAuditLog({
    actor_telegram_user_id: String(ctx.from?.id ?? config.ownerTelegramId),
    action: "owner.notify.broadcast",
    target_table: "telegram_users",
    safe_description: `Owner broadcast notification to ${sent} chat(s); ${failed} failed`
  }).catch(() => undefined);

  await ctx.reply([
    "Notify complete, Sir.",
    `Sent: ${sent}`,
    `Failed: ${failed}`,
    `Skipped: ${Math.max(0, recipients.length - uniqueChatIds.length)}`
  ].join("\n"));
}

function getMessage(ctx: Context): string {
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  return text.replace(/^\/notify(?:@\w+)?\s*/i, "").trim();
}

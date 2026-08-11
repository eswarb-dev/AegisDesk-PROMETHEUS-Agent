import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { memoryStatus, memorySummary } from "../memory/memoryFormatter.js";
import { MemoryStore } from "../memory/memoryStore.js";
import { isOwner } from "../memory/ownerMemory.js";
import { userMemoryStore } from "../memory/userMemoryStore.js";

export async function memoryCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, store: MemoryStore): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("PROMETHEUS is active, but this personalised memory is owner-only.");
    return;
  }

  const message = ctx.message as { text?: string } | undefined;
  const text = message?.text ?? "";
  const subcommand = text?.split(/\s+/)[1]?.toLowerCase();

  if (subcommand === "reload") {
    await store.reloadMemory();
    await userMemoryStore.load(true);
    await ctx.reply("Memory reloaded.");
    return;
  }

  if (subcommand === "users") {
    const users = (await userMemoryStore.load()).users;
    await ctx.reply(
      [
        "User Memories",
        "",
        ...(users.length
          ? users.map((user) => `${user.display_name}\nID: ${user.telegram_user_id}\nRole: ${user.role}\nSummary: ${user.conversation_summary ? "stored" : "empty"}`)
          : ["No user memories stored."])
      ].join("\n\n")
    );
    return;
  }

  if (subcommand === "user") {
    const userId = text.split(/\s+/)[2];
    const user = userId ? await userMemoryStore.get(userId) : undefined;
    await ctx.reply(
      user
        ? [
            `User: ${user.display_name}`,
            `ID: ${user.telegram_user_id}`,
            `Role: ${user.role}`,
            `Contact: ${user.contact_id ?? "none"}`,
            `Memory enabled: ${user.memory_enabled}`,
            `Summary: ${user.conversation_summary || "empty"}`,
            `Safe notes: ${user.safe_notes.length}`
          ].join("\n")
        : "Usage: /memory user <telegram_user_id>"
    );
    return;
  }

  const memory = await store.loadMemory();
  await ctx.reply(subcommand === "summary" ? memorySummary(memory) : memoryStatus(memory));
}

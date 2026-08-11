import type { Context } from "telegraf";
import { userMemoryStore } from "../memory/userMemoryStore.js";

export async function forgetmeCommand(ctx: Context): Promise<void> {
  if (!ctx.from?.id) return;
  await userMemoryStore.forget(ctx.from.id);
  await ctx.reply("Your stored PROMETHEUS user memory has been deleted.");
}

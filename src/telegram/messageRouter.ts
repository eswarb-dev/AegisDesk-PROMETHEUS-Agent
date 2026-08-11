import type { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { userMemoryStore } from "../memory/userMemoryStore.js";
import { PrometheusBrain } from "../prometheus/prometheusBrain.js";

export function registerMessageRouter(bot: Telegraf, brain: PrometheusBrain): void {
  bot.on(message("text"), async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    const response = await brain.respond(ctx.from?.id, ctx.message.text);
    await ctx.reply(response);
    if (ctx.from?.id) {
      await userMemoryStore.appendSafeSummary(ctx.from.id, ctx.message.text);
    }
  });
}

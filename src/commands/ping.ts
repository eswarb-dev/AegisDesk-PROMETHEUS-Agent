import type { Context } from "telegraf";

export async function pingCommand(ctx: Context): Promise<void> {
  const start = Date.now();
  await ctx.reply(["⚡ PROMETHEUS online", "Render: active", `Latency: ${Date.now() - start} ms`].join("\n"));
}

import type { Context } from "telegraf";

export async function aboutCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      "PROMETHEUS",
      "Personalised Agent to Eswar B",
      "AEGISDESK // AGENT SYSTEM",
      "",
      "This Telegram bot is a conversational interface for PROMETHEUS.",
      "Built to remember context, respond naturally, and stay aligned with Eswar's preferences.",
      "",
      "No device control is enabled in this Telegram bot."
    ].join("\n")
  );
}

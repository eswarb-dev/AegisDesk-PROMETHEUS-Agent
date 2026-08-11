import type { Context } from "telegraf";

export async function privacyCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      "PROMETHEUS privacy:",
      "",
      "- I store short summaries and bot conversation history for continuity.",
      "- Eswar, the owner, may review conversations that happen inside this bot.",
      "- For trusted contacts, I may summarize emotional distress to Eswar.",
      "- I do not share every message automatically.",
      "- I cannot access your private Telegram chats.",
      "- I do not store passwords, tokens, OTPs, or secrets.",
      "- You can use /forgetme to delete your stored memory."
    ].join("\n")
  );
}

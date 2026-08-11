import type { Context } from "telegraf";

export async function privacyCommand(ctx: Context): Promise<void> {
  await ctx.reply(
    [
      "Privacy",
      "",
      "PROMETHEUS may store short safe summaries of your conversations for continuity.",
      "It does not store raw full conversations as primary memory.",
      "Secrets, tokens, OTPs, passwords, and payment info should not be stored.",
      "Eswar's private owner memory remains restricted.",
      "",
      "Use /forgetme to delete your stored user memory."
    ].join("\n")
  );
}

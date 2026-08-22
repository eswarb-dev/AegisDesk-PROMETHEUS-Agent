import type { Context } from "telegraf";
import type { StorageProvider } from "../storage/storageProvider.js";

export async function styleCommand(ctx: Context, storage: StorageProvider): Promise<void> {
  if (!ctx.from?.id) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Style learning needs Supabase storage.");
    return;
  }
  const profile = await storage.styles.getProfile(ctx.from.id);
  if (!profile) {
    await ctx.reply("No learned style profile yet.\nPROMETHEUS will learn only safe reply-style patterns inside this bot.");
    return;
  }
  await ctx.reply([
    "PROMETHEUS Style Profile",
    "",
    `Address: ${profile.address_preference ?? "not set"}`,
    `Tone: ${profile.preferred_tone}`,
    `Reply length: ${profile.preferred_reply_length}`,
    `Emoji use: ${profile.emoji_preference}`,
    `Slang: ${profile.slang_terms.length ? profile.slang_terms.join(", ") : "none"}`,
    `Dislikes: ${profile.dislikes.length ? profile.dislikes.join(", ") : "none"}`,
    `Learning: ${profile.learning_enabled === false ? "off" : "on"}`
  ].join("\n"));
}

export async function resetStyleCommand(ctx: Context, storage: StorageProvider): Promise<void> {
  if (!ctx.from?.id) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Style learning needs Supabase storage.");
    return;
  }
  await storage.styles.deleteProfile(ctx.from.id);
  await ctx.reply("Your learned PROMETHEUS style profile has been reset.");
}

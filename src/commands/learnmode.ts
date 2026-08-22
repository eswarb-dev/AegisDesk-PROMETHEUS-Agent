import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isOwner } from "../memory/ownerMemory.js";
import type { UserRole } from "../memory/memoryTypes.js";
import type { StorageProvider } from "../storage/storageProvider.js";

export async function learnmodeCommand(ctx: Context, config: AppConfig, storage: StorageProvider): Promise<void> {
  if (!ctx.from?.id) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Learn mode needs Supabase storage.");
    return;
  }
  const arg = ((ctx.message as { text?: string } | undefined)?.text ?? "").trim().split(/\s+/)[1]?.toLowerCase();
  const user = await storage.users.getTelegramUserById(ctx.from.id);
  const role = (isOwner(ctx.from.id, config) ? "owner" : user?.role ?? "user") as UserRole;
  const contactId = user?.contact_id ?? null;

  if (arg === "on" || arg === "off") {
    const enabled = arg === "on";
    await storage.styles.setLearningEnabled(ctx.from.id, enabled, role, contactId);
    await ctx.reply(`Adaptive style learning is now ${enabled ? "on" : "off"} for you.`);
    return;
  }

  const profile = await storage.styles.getProfile(ctx.from.id);
  await ctx.reply([
    "PROMETHEUS Learn Mode",
    "",
    `Status: ${profile?.learning_enabled === false ? "off" : "on"}`,
    "Scope: safe style, slang, emoji preference, reply length, and support preference.",
    "Never learned: passwords, OTPs, API keys, private keys, payment data, or raw full conversations.",
    "",
    "Use:",
    "/learnmode on",
    "/learnmode off"
  ].join("\n"));
}

import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import { isOwner } from "../memory/ownerMemory.js";
import type { StorageProvider } from "../storage/storageProvider.js";

const OWNER_RESTRICTED = "PROMETHEUS is active.\nThat help section is owner-restricted.";

export async function helpCommand(
  ctx: Context,
  config?: Pick<AppConfig, "ownerTelegramId">,
  contacts?: TrustedContactService,
  storage?: StorageProvider
): Promise<void> {
  const section = getHelpSection(ctx);
  const role = await resolveHelpRole(ctx, config, contacts, storage);

  if (section === "owner") {
    await replyOwnerHelp(ctx, role);
    return;
  }
  if (section === "logs") {
    await replyOwnerRestricted(ctx, role, logsHelp());
    return;
  }
  if (section === "contacts") {
    await replyOwnerRestricted(ctx, role, contactsHelp());
    return;
  }
  if (section === "support") {
    await replyOwnerRestricted(ctx, role, supportHelp());
    return;
  }
  if (section === "trusted") {
    await ctx.reply(role === "owner" || role === "trusted_contact" ? trustedHelp() : OWNER_RESTRICTED);
    return;
  }

  if (role === "owner") {
    await ctx.reply(ownerHelp());
    return;
  }
  if (role === "trusted_contact") {
    await ctx.reply(trustedHelp());
    return;
  }
  await ctx.reply(publicHelp());
}

function publicHelp(): string {
  return [
    "PROMETHEUS Commands",
    "",
    "/start       Activate PROMETHEUS",
    "/about       About PROMETHEUS",
    "/ping        Check connectivity",
    "/play        Open music search links",
    "/privacy     Memory/privacy policy",
    "/forgetme    Delete your stored PROMETHEUS memory",
    "/whoami      Show your Telegram ID and role"
  ].join("\n");
}

function trustedHelp(): string {
  return [
    "PROMETHEUS Trusted Contact Commands",
    "",
    "/start",
    "/about",
    "/ping",
    "/play",
    "/privacy",
    "/forgetme",
    "/whoami",
    "/supportoff",
    "",
    "You can talk to me normally.",
    "I can support you and remember safe summaries for continuity.",
    "Owner-only memory remains restricted."
  ].join("\n");
}

function ownerHelp(): string {
  return [
    "PROMETHEUS Owner Commands",
    "",
    "Core:",
    "/start",
    "/about",
    "/ping",
    "/play",
    "/whoami",
    "/privacy",
    "",
    "Memory:",
    "/memory",
    "/help owner",
    "",
    "Contacts:",
    "/contacts",
    "/notify <message>",
    "/help contacts",
    "",
    "Admin logs:",
    "/admin",
    "/help logs",
    "",
    "Support:",
    "/support",
    "/help support",
    "",
    "Natural commands also work:",
    "- Did Vathanya talk to you?",
    "- What did Aksharaa ask?",
    "- Can you text Aksharaa?"
  ].join("\n");
}

function ownerMemoryHelp(): string {
  return [
    "PROMETHEUS Owner Memory Commands",
    "",
    "/memory",
    "/memory summary",
    "/memory reload",
    "/memory user <contact_id>",
    "/shareindex",
    "/state"
  ].join("\n");
}

function logsHelp(): string {
  return [
    "PROMETHEUS Owner Log Commands",
    "",
    "/users",
    "/logs",
    "/logs <contact_id>",
    "/chat <contact_id>",
    "/chat <contact_id> <limit>",
    "/search <contact_id> <query>",
    "/summary <contact_id>",
    "/export <contact_id>",
    "/audit"
  ].join("\n");
}

function contactsHelp(): string {
  return [
    "PROMETHEUS Trusted Contact Management",
    "",
    "/contacts",
    "/trust <telegram_user_id> <contact_id>",
    "/untrust <contact_id>",
    "/tell <contact_id> <message>"
  ].join("\n");
}

function supportHelp(): string {
  return [
    "PROMETHEUS Support Commands",
    "",
    "/support",
    "/support <contact_id>",
    "/support alerts",
    "/support settings",
    "/supportoff"
  ].join("\n");
}

async function replyOwnerHelp(ctx: Context, role: string): Promise<void> {
  if (role !== "owner") {
    await ctx.reply(OWNER_RESTRICTED);
    return;
  }
  await ctx.reply(ownerMemoryHelp());
}

async function replyOwnerRestricted(ctx: Context, role: string, text: string): Promise<void> {
  if (role !== "owner") {
    await ctx.reply(OWNER_RESTRICTED);
    return;
  }
  await ctx.reply(text);
}

async function resolveHelpRole(ctx: Context, config?: Pick<AppConfig, "ownerTelegramId">, contacts?: TrustedContactService, storage?: StorageProvider): Promise<string> {
  if (config && isOwner(ctx.from?.id, config)) return "owner";
  if (storage?.kind === "supabase" && ctx.from?.id) {
    const user = await storage.users.getTelegramUserById(ctx.from.id).catch(() => null);
    if (user?.role) return user.role;
  }
  if (contacts && ctx.from?.id) return (await contacts.resolveRole(ctx.from.id)).role;
  return "user";
}

function getHelpSection(ctx: Context): string | undefined {
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  return text.trim().split(/\s+/)[1]?.toLowerCase();
}

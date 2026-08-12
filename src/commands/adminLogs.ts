import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import type { ContactId } from "../contacts/trustedContactTypes.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import type { BotMessageRow } from "../storage/messageRepository.js";
import { isOwner } from "../memory/ownerMemory.js";
import { buildUsersResponse, parseUsersMode } from "./usersList.js";

const ALLOWED_CONTACTS: ContactId[] = ["aksharaa", "vathanya", "maddhurika"];
const OWNER_RESTRICTED = "PROMETHEUS is active.\nThis command is owner-restricted.";

export async function usersCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId" | "botTimezone">, storage: StorageProvider): Promise<void> {
  if (!requireOwner(ctx, config)) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Supabase storage is required for PROMETHEUS log administration.");
    return;
  }
  const users = await storage.admin.getUsers();
  const stats = await storage.messages.getUserMessageStats();
  const mode = parseUsersMode((ctx.message as { text?: string } | undefined)?.text ?? "");
  await safeAudit(ctx, storage, "admin.users.view", null, "Owner viewed bot user list");
  await ctx.reply(buildUsersResponse({
    users,
    stats,
    mode,
    ownerTelegramId: config.ownerTelegramId,
    timezone: config.botTimezone
  }));
}

export async function ownerContactsCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, storage: StorageProvider): Promise<void> {
  if (!requireOwner(ctx, config)) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Supabase storage is required for PROMETHEUS contact administration.");
    return;
  }
  const contacts = await storage.contacts.list();
  await safeAudit(ctx, storage, "admin.contacts.view", null, "Owner viewed trusted contacts and pending users");
  await ctx.reply([
    "Trusted contacts",
    ...contacts.trusted_contacts.map((contact) => `${contact.name} (${contact.id}): ${contact.telegram_user_id ? `linked to ${contact.telegram_user_id}` : "not linked"}`),
    "",
    "Pending users",
    ...(contacts.pending_users.length ? contacts.pending_users.map((user) => `${user.display_name}: ${user.telegram_user_id}`) : ["None"])
  ].join("\n"));
}

export async function logsCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, storage: StorageProvider): Promise<void> {
  if (!requireOwner(ctx, config)) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Supabase storage is required for PROMETHEUS logs.");
    return;
  }
  const [contactId] = getArgs(ctx);
  if (contactId && !isAllowedContact(contactId)) {
    await ctx.reply("Unknown trusted contact. Allowed: aksharaa, vathanya, maddhurika.");
    return;
  }
  const user = contactId ? await findUserForContact(storage, contactId) : null;
  const messages = contactId
    ? await storage.messages.getMessagesByContactId(contactId, user?.telegram_user_id, 20)
    : await storage.messages.getRecentMessages({ limit: 20 });
  await safeAudit(ctx, storage, "admin.logs.view", contactId ?? null, contactId ? `Owner viewed ${contactId} bot logs` : "Owner viewed recent bot logs");
  await ctx.reply(messages.length ? formatMessages(contactId ? `${titleCase(contactId)} — recent PROMETHEUS logs` : "Recent PROMETHEUS bot activity", messages) : noMessages(contactId));
}

export async function chatCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, storage: StorageProvider): Promise<void> {
  if (!requireOwner(ctx, config)) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Supabase storage is required for PROMETHEUS chat logs.");
    return;
  }
  const [contactId, limitText] = getArgs(ctx);
  if (!contactId || !isAllowedContact(contactId)) {
    await ctx.reply("Usage: /chat <aksharaa|vathanya|maddhurika> [limit]");
    return;
  }
  const user = await findUserForContact(storage, contactId);
  const messages = await storage.messages.getMessagesByContactId(contactId, user?.telegram_user_id, Number(limitText) || 20);
  await safeAudit(ctx, storage, "admin.chat.view", contactId, `Owner viewed ${contactId} bot conversation`);
  await ctx.reply(messages.length ? formatMessages(`${titleCase(contactId)} — latest bot conversation`, messages) : noMessages(contactId));
}

export async function searchCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, storage: StorageProvider): Promise<void> {
  if (!requireOwner(ctx, config)) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Supabase storage is required for PROMETHEUS search.");
    return;
  }
  const [contactId, ...queryParts] = getArgs(ctx);
  const query = queryParts.join(" ").trim();
  if (!contactId || !isAllowedContact(contactId) || !query) {
    await ctx.reply("Usage: /search <aksharaa|vathanya|maddhurika> <query>");
    return;
  }
  const user = await findUserForContact(storage, contactId);
  const messages = await storage.messages.searchMessagesByContactId({ contactId, telegramUserId: user?.telegram_user_id, query, limit: 20 });
  await safeAudit(ctx, storage, "admin.logs.search", contactId, `Owner searched ${contactId} bot logs`);
  await ctx.reply(messages.length ? formatMessages(`${titleCase(contactId)} — PROMETHEUS log search`, messages) : `No PROMETHEUS bot log matches for ${titleCase(contactId)}.`);
}

export async function summaryCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, storage: StorageProvider): Promise<void> {
  if (!requireOwner(ctx, config)) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Supabase storage is required for PROMETHEUS summaries.");
    return;
  }
  const [contactId] = getArgs(ctx);
  if (!contactId || !isAllowedContact(contactId)) {
    await ctx.reply("Usage: /summary <aksharaa|vathanya|maddhurika>");
    return;
  }
  const user = await findUserForContact(storage, contactId);
  if (!user) {
    await ctx.reply(`${titleCase(contactId)} is not linked to a Telegram ID yet, so I cannot verify bot conversations.`);
    return;
  }
  const summary = await storage.conversations.getConversationSummary(user.telegram_user_id);
  await safeAudit(ctx, storage, "admin.summary.view", contactId, `Owner viewed ${contactId} conversation summary`);
  await ctx.reply(summary ? `${titleCase(contactId)} — PROMETHEUS conversation summary\n${summary.short_summary}` : `No PROMETHEUS conversation summary found for ${titleCase(contactId)}.`);
}

export async function memoryUserCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, storage: StorageProvider): Promise<void> {
  if (!requireOwner(ctx, config)) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Supabase storage is required for PROMETHEUS memory admin.");
    return;
  }
  const [scope, contactId] = getArgs(ctx);
  if (scope !== "user" || !contactId || !isAllowedContact(contactId)) {
    await ctx.reply("Usage: /memory user <aksharaa|vathanya|maddhurika>");
    return;
  }
  const user = await findUserForContact(storage, contactId);
  if (!user) {
    await ctx.reply(`${titleCase(contactId)} is not linked to a Telegram ID yet.`);
    return;
  }
  const summary = await storage.conversations.getConversationSummary(user.telegram_user_id);
  await safeAudit(ctx, storage, "admin.memory.view", contactId, `Owner viewed ${contactId} memory summary`);
  await ctx.reply(summary ? `${titleCase(contactId)} memory summary\n${summary.short_summary}` : `No stored PROMETHEUS memory summary for ${titleCase(contactId)}.`);
}

export async function exportCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, storage: StorageProvider): Promise<void> {
  if (!requireOwner(ctx, config)) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Supabase storage is required for PROMETHEUS exports.");
    return;
  }
  const [contactId] = getArgs(ctx);
  if (!contactId || !isAllowedContact(contactId)) {
    await ctx.reply("Usage: /export <aksharaa|vathanya|maddhurika>");
    return;
  }
  const messages = await storage.messages.exportMessages(contactId);
  const body = buildExport(contactId, messages);
  await safeAudit(ctx, storage, "admin.export", contactId, `Owner exported ${contactId} bot conversation`);
  if ("replyWithDocument" in ctx && typeof ctx.replyWithDocument === "function") {
    await ctx.replyWithDocument({ source: Buffer.from(body), filename: `prometheus-${contactId}-conversation.txt` });
    return;
  }
  await ctx.reply(body.slice(0, 3900));
}

export async function auditCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, storage: StorageProvider): Promise<void> {
  if (!requireOwner(ctx, config)) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Supabase storage is required for PROMETHEUS audit logs.");
    return;
  }
  const logs = await storage.admin.getAuditLogs();
  await ctx.reply(logs.length ? ["Recent PROMETHEUS admin audit", ...logs.map((log) => `${formatTime(log.created_at)} ${log.action}: ${log.safe_description ?? ""}`)].join("\n") : "No PROMETHEUS admin audit logs yet.");
}

export async function answerOwnerLogQuestion(text: string, ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, storage: StorageProvider): Promise<boolean> {
  if (!isOwner(ctx.from?.id, config) || storage.kind !== "supabase") return false;
  const contactId = extractContactId(text);
  if (!contactId) {
    if (/who messaged you today|summari[sz]e today/i.test(text)) {
      const messages = await storage.messages.getMessagesToday();
      await ctx.reply(messages.length ? formatMessages("Today in PROMETHEUS bot logs", messages) : "I checked my bot logs. Nobody has messaged PROMETHEUS today.");
      return true;
    }
    return false;
  }
  if (/did .*talk|messaged? you|has .*talked/i.test(text)) {
    const user = await findUserForContact(storage, contactId);
    if (!user) {
      await ctx.reply(`${titleCase(contactId)} is not linked to a Telegram ID yet, so I cannot verify their bot conversations.`);
      return true;
    }
    const latest = await storage.messages.getMessagesByContactId(contactId, user.telegram_user_id, 1).then((messages) => messages.at(-1) ?? null);
    await ctx.reply(latest ? `I checked my bot logs. Yes, ${titleCase(contactId)} talked to me inside this bot at ${formatTime(latest.created_at)}.\nLatest topic: ${(latest.text_redacted ?? latest.text ?? "").slice(0, 180)}` : `I checked my bot logs, Eswar. ${titleCase(contactId)} has not messaged PROMETHEUS yet inside this bot.`);
    return true;
  }
  if (/what did .*ask|show .*logs|last messages?/i.test(text)) {
    const user = await findUserForContact(storage, contactId);
    const messages = await storage.messages.getMessagesByContactId(contactId, user?.telegram_user_id, 10);
    await ctx.reply(messages.length ? formatMessages(`${titleCase(contactId)} — PROMETHEUS bot logs`, messages) : noMessages(contactId));
    return true;
  }
  return false;
}

function requireOwner(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">): boolean {
  if (isOwner(ctx.from?.id, config)) return true;
  void ctx.reply(OWNER_RESTRICTED);
  return false;
}

function getArgs(ctx: Context): string[] {
  const message = ctx.message as { text?: string } | undefined;
  const text = message?.text ?? "";
  return text.trim().split(/\s+/).slice(1);
}

function isAllowedContact(value: string): value is ContactId {
  return ALLOWED_CONTACTS.includes(value.toLowerCase() as ContactId);
}

function extractContactId(text: string): ContactId | null {
  const lowered = text.toLowerCase();
  return ALLOWED_CONTACTS.find((contact) => lowered.includes(contact)) ?? null;
}

async function findUserForContact(storage: Extract<StorageProvider, { kind: "supabase" }>, contactId: string) {
  const contacts = await storage.contacts.list();
  const contact = contacts.trusted_contacts.find((item) => item.id === contactId);
  if (!contact?.telegram_user_id) return storage.users.getTelegramUserByContactId(contactId);
  return storage.users.getTelegramUserById(contact.telegram_user_id);
}

async function safeAudit(ctx: Context, storage: Extract<StorageProvider, { kind: "supabase" }>, action: string, contactId: string | null, safeDescription: string): Promise<void> {
  try {
    await audit(ctx, storage, action, contactId, safeDescription);
  } catch {
    // Admin actions should still answer the owner if audit storage is behind the code schema.
  }
}

async function audit(ctx: Context, storage: Extract<StorageProvider, { kind: "supabase" }>, action: string, contactId: string | null, safeDescription: string): Promise<void> {
  await storage.admin.writeAuditLog({
    actor_telegram_user_id: String(ctx.from?.id ?? ""),
    action,
    target_contact_id: contactId,
    safe_description: safeDescription
  });
}

function formatMessages(title: string, messages: BotMessageRow[]): string {
  return [title, "", ...messages.map((message) => `${formatTime(message.created_at)}  ${message.direction === "inbound" ? titleCase(message.contact_id ?? "User") : "PROMETHEUS"}:\n${message.text_redacted ?? message.text ?? ""}`)].join("\n\n");
}

function noMessages(contactId?: string | null): string {
  return contactId ? `I checked my bot logs. ${titleCase(contactId)} has no PROMETHEUS bot conversation yet.` : "No PROMETHEUS bot activity found.";
}

function buildExport(contactId: string, messages: BotMessageRow[]): string {
  return [
    "PROMETHEUS Bot Conversation Export",
    `Contact: ${titleCase(contactId)}`,
    "Scope: messages inside @AegisDesk_PrometheusBot only",
    "Generated by: owner",
    `Generated at: ${new Date().toISOString()}`,
    "",
    ...messages.map((message) => `[${message.created_at ?? ""}] ${message.direction === "inbound" ? titleCase(contactId) : "PROMETHEUS"}: ${message.text_redacted ?? message.text ?? ""}`)
  ].join("\n");
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function formatTime(value?: string | null): string {
  if (!value) return "unknown time";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(value));
}

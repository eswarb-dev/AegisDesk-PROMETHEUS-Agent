import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { GroqClient } from "../prometheus/groqClient.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import { GmailClient } from "../skills/gmail/gmailClient.js";
import { GmailDraftSkill } from "../skills/gmail/gmailDraftSkill.js";
import { parseRecipients, redactEmail, validateDraftInput } from "../skills/gmail/gmailPolicy.js";
import type { GmailDraftResult, MailDraftInput } from "../skills/gmail/gmailTypes.js";

type GmailApi = {
  createDraft(input: MailDraftInput): Promise<GmailDraftResult>;
  deleteDraft?(draftId: string): Promise<void>;
};

type MailDeps = {
  gmail?: GmailApi;
  aiSkill?: Pick<GmailDraftSkill, "buildAiDraft">;
  now?: () => number;
};

type PendingDraft = {
  ownerTelegramUserId: string;
  draft: MailDraftInput;
  expiresAt: number;
};

const pendingDrafts = new Map<string, PendingDraft>();
const pendingTtlMs = 10 * 60 * 1000;

export async function mailCommand(ctx: Context, config: AppConfig, storage: StorageProvider, deps: MailDeps = {}): Promise<void> {
  if (!isOwner(ctx, config)) {
    await ctx.reply("PROMETHEUS is active.\nMail drafting is owner-restricted.");
    return;
  }
  if (storage.kind !== "supabase") {
    await ctx.reply("Mail drafting requires Supabase storage, Sir.");
    return;
  }

  const text = getMessageText(ctx);
  const args = text.replace(/^\/mail(?:@\w+)?\s*/i, "").trim();
  if (!args) {
    await ctx.reply(mailHelp());
    return;
  }

  const [subcommand, ...rest] = args.split(/\s+/);
  const remainder = args.slice(subcommand.length).trim();
  const gmail = deps.gmail ?? new GmailClient(config);

  if (subcommand === "draft") {
    const parsed = parseDraftCommand(remainder);
    if (!parsed.ok) {
      await ctx.reply(`Message not drafted, Sir.\nReason: ${parsed.reason}.`);
      return;
    }
    await createAndRecordDraft(ctx, config, storage, gmail, parsed.draft, "mail draft");
    return;
  }

  if (subcommand === "draft_ai") {
    const parsed = parseAiDraftCommand(remainder);
    if (!parsed.ok) {
      await ctx.reply(`Message not drafted, Sir.\nReason: ${parsed.reason}.`);
      return;
    }
    const aiSkill = deps.aiSkill ?? new GmailDraftSkill(config, new GroqClient(config));
    try {
      const draft = await aiSkill.buildAiDraft(parsed.to, parsed.purpose);
      const policy = validateDraftInput(draft);
      if (!policy.ok) {
        await ctx.reply(`Message not drafted, Sir.\nReason: ${policy.reason}.`);
        return;
      }
      pendingDrafts.set(String(ctx.from?.id), {
        ownerTelegramUserId: String(ctx.from?.id),
        draft,
        expiresAt: (deps.now?.() ?? Date.now()) + pendingTtlMs
      });
      await ctx.reply([
        "Draft preview:",
        "",
        "To:",
        draft.to.join(", "),
        "",
        "Subject:",
        draft.subject,
        "",
        "Body:",
        previewText(draft.body, 1400),
        "",
        "Type:",
        "CONFIRM DRAFT",
        "",
        "to create Gmail draft."
      ].join("\n"));
    } catch {
      await ctx.reply("I could not draft with Groq right now, Sir.\nYou can use /mail draft with your own body.");
    }
    return;
  }

  if (subcommand === "drafts") {
    const drafts = await storage.mailDrafts.listRecent(config.ownerTelegramId, 10);
    await ctx.reply(drafts.length ? [
      "Recent PROMETHEUS Gmail drafts",
      "",
      ...drafts.map((draft) => `${draft.gmail_draft_id} | ${draft.status} | ${draft.to_email} | ${draft.subject}`)
    ].join("\n") : "No PROMETHEUS Gmail drafts recorded yet, Sir.");
    return;
  }

  if (subcommand === "preview") {
    const draftId = remainder.trim();
    if (!draftId) {
      await ctx.reply("Usage: /mail preview <draft_id>");
      return;
    }
    const draft = await storage.mailDrafts.findByDraftId(config.ownerTelegramId, draftId);
    if (!draft) {
      await ctx.reply("Draft record not found, Sir.");
      return;
    }
    await ctx.reply([
      "Draft preview:",
      "",
      `Gmail draft: ${draft.gmail_draft_id}`,
      `Status: ${draft.status}`,
      `To: ${draft.to_email}`,
      `Subject: ${draft.subject}`,
      "",
      "Body preview:",
      draft.body_preview ?? "(empty)"
    ].join("\n"));
    return;
  }

  if (subcommand === "discard") {
    const draftId = remainder.trim();
    if (!draftId) {
      await ctx.reply("Usage: /mail discard <draft_id>");
      return;
    }
    const draft = await storage.mailDrafts.findByDraftId(config.ownerTelegramId, draftId);
    if (!draft) {
      await ctx.reply("Draft record not found, Sir.");
      return;
    }
    try {
      await gmail.deleteDraft?.(draftId);
      await storage.mailDrafts.markDiscarded(config.ownerTelegramId, draftId);
      await ctx.reply(`Draft discarded, Sir.\nGmail draft: ${draftId}`);
    } catch {
      await ctx.reply("Draft discard failed, Sir.\nReason: Gmail draft access is not available right now.");
    }
    return;
  }

  await ctx.reply(mailHelp());
}

export async function handleMailDraftConfirmation(ctx: Context, config: AppConfig, storage: StorageProvider, deps: MailDeps = {}): Promise<boolean> {
  const text = getMessageText(ctx).trim();
  if (!/^CONFIRM DRAFT$|^CANCEL DRAFT$/i.test(text)) return false;
  if (!isOwner(ctx, config)) {
    await ctx.reply("PROMETHEUS is active.\nMail drafting is owner-restricted.");
    return true;
  }
  if (storage.kind !== "supabase") {
    await ctx.reply("Mail drafting requires Supabase storage, Sir.");
    return true;
  }
  const key = String(ctx.from?.id);
  const pending = pendingDrafts.get(key);
  if (!pending) {
    await ctx.reply("No pending mail draft found, Sir.");
    return true;
  }
  if (/^CANCEL DRAFT$/i.test(text)) {
    pendingDrafts.delete(key);
    await ctx.reply("Pending mail draft cancelled, Sir.");
    return true;
  }
  if ((deps.now?.() ?? Date.now()) > pending.expiresAt) {
    pendingDrafts.delete(key);
    await ctx.reply("Pending mail draft expired, Sir.\nUse /mail draft_ai again.");
    return true;
  }
  const gmail = deps.gmail ?? new GmailClient(config);
  await createAndRecordDraft(ctx, config, storage, gmail, pending.draft, "mail draft_ai");
  pendingDrafts.delete(key);
  return true;
}

export function clearPendingMailDraftsForTest(): void {
  pendingDrafts.clear();
}

async function createAndRecordDraft(ctx: Context, config: AppConfig, storage: Extract<StorageProvider, { kind: "supabase" }>, gmail: GmailApi, draft: MailDraftInput, command: string): Promise<void> {
  const policy = validateDraftInput(draft);
  if (!policy.ok) {
    await ctx.reply(`Message not drafted, Sir.\nReason: ${policy.reason}.`);
    return;
  }
  const configCheck = validateGmailConfig(config);
  if (!configCheck.ok) {
    await ctx.reply(`Message not drafted, Sir.\nReason: ${configCheck.reason}.`);
    return;
  }
  let result: GmailDraftResult;
  try {
    result = await gmail.createDraft(draft);
    await storage.mailDrafts.create({
      gmail_draft_id: result.id,
      owner_telegram_user_id: config.ownerTelegramId,
      to_email: draft.to.join(", "),
      subject: draft.subject,
      body_preview: previewText(draft.body, 300),
      status: "created",
      created_by_command: command
    });
    await storage.audit.writeAuditLog({
      actor_telegram_user_id: config.ownerTelegramId,
      action: "gmail_draft_created",
      target_table: "gmail_drafts",
      target_id: result.id,
      safe_description: `Draft created to ${draft.to.map(redactEmail).join(", ")} with subject ${draft.subject}`
    });
  } catch {
    await ctx.reply("Message not drafted, Sir.\nReason: Gmail draft access is not available right now. Check OAuth env vars and refresh token.");
    return;
  }
  await ctx.reply([
    "Draft created, Sir ✅",
    "",
    "From:",
    `${config.gmailSenderName} <${config.gmailSenderEmail}>`,
    "",
    "To:",
    draft.to.join(", "),
    "",
    "Subject:",
    draft.subject,
    "",
    "Gmail draft:",
    result.id,
    "",
    "Open Gmail drafts to review and send manually."
  ].join("\n"));
}

function validateGmailConfig(config: AppConfig): { ok: true } | { ok: false; reason: string } {
  if (!config.gmailDraftsEnabled) return { ok: false, reason: "Gmail drafts are disabled" };
  if (!config.googleClientId || !config.googleClientSecret || !config.gmailRefreshToken) {
    return { ok: false, reason: "Gmail OAuth is not configured" };
  }
  if (config.gmailSenderEmail.toLowerCase() !== "prometheus.inference@gmail.com") {
    return { ok: false, reason: "Gmail sender is not configured as PROMETHEUS official mail" };
  }
  return { ok: true };
}

function parseDraftCommand(input: string): { ok: true; draft: MailDraftInput } | { ok: false; reason: string } {
  const parts = input.split("|").map((part) => part.trim());
  if (parts.length < 3) return { ok: false, reason: "usage is /mail draft <to> | <subject> | <message>" };
  const draft = { to: parseRecipients(parts[0]), subject: parts[1], body: parts.slice(2).join(" | ").trim() };
  const policy = validateDraftInput(draft);
  return policy.ok ? { ok: true, draft } : { ok: false, reason: policy.reason };
}

function parseAiDraftCommand(input: string): { ok: true; to: string[]; purpose: string } | { ok: false; reason: string } {
  const parts = input.split("|").map((part) => part.trim());
  if (parts.length !== 2) return { ok: false, reason: "usage is /mail draft_ai <to> | <purpose>" };
  const to = parseRecipients(parts[0]);
  const purpose = parts[1];
  const policy = validateDraftInput({ to, subject: "Draft", body: purpose });
  if (!policy.ok) return { ok: false, reason: policy.reason };
  return { ok: true, to, purpose };
}

function getMessageText(ctx: Context): string {
  return "message" in ctx && ctx.message && "text" in ctx.message ? String(ctx.message.text) : "";
}

function isOwner(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">): boolean {
  return String(ctx.from?.id) === String(config.ownerTelegramId);
}

function previewText(text: string, limit: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 3)}...` : clean;
}

function mailHelp(): string {
  return [
    "PROMETHEUS Mail Draft Skill",
    "",
    "/mail draft <to> | <subject> | <message>",
    "/mail draft_ai <to> | <purpose>",
    "/mail drafts",
    "/mail preview <draft_id>",
    "/mail discard <draft_id>",
    "",
    "Phase 1 creates Gmail drafts only. It does not send emails."
  ].join("\n");
}

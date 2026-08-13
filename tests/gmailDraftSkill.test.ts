import { describe, expect, it, vi, beforeEach } from "vitest";
import { clearPendingMailDraftsForTest, handleMailDraftConfirmation, mailCommand } from "../src/commands/mail.js";
import { GmailApiError, GmailClient } from "../src/skills/gmail/gmailClient.js";
import { buildMimeMessage, encodeBase64Url, prometheusMailSignature } from "../src/skills/gmail/gmailMimeBuilder.js";
import { GmailOAuthError } from "../src/skills/gmail/gmailOAuth.js";
import { validateDraftInput } from "../src/skills/gmail/gmailPolicy.js";
import { createMockContext } from "./helpers.js";

const config = {
  ownerTelegramId: "1001",
  botTimezone: "Asia/Kolkata",
  telegramBotToken: "test",
  groqModel: "test",
  databaseProvider: "supabase" as const,
  nodeEnv: "test" as const,
  port: 3000,
  gmailSenderEmail: "prometheus.inference@gmail.com",
  gmailSenderName: "PROMETHEUS",
  gmailDraftsEnabled: true,
  googleClientId: "client-id-value",
  googleClientSecret: "client-secret-value",
  googleRedirectUri: "http://localhost:3000/oauth2callback",
  gmailRefreshToken: "refresh-token-value"
};

function createMailStorage() {
  const records: unknown[] = [];
  const audits: unknown[] = [];
  return {
    kind: "supabase",
    mailDrafts: {
      create: vi.fn(async (record) => {
        records.push(record);
        return { ...record, id: "row-1", created_at: new Date().toISOString() };
      }),
      listRecent: vi.fn(async () => records),
      findByDraftId: vi.fn(async (_owner, draftId) => records.find((record) => (record as { gmail_draft_id: string }).gmail_draft_id === draftId) ?? null),
      markDiscarded: vi.fn(async () => undefined),
      markSent: vi.fn(async () => undefined)
    },
    audit: {
      writeAuditLog: vi.fn(async (input) => {
        audits.push(input);
      })
    },
    _records: records,
    _audits: audits
  };
}

describe("Gmail Draft Skill", () => {
  beforeEach(() => clearPendingMailDraftsForTest());

  it("owner can view /mail help and non-owner/trusted users are rejected", async () => {
    const storage = createMailStorage();
    const ownerCtx = createMockContext({ userId: 1001, text: "/mail" });
    const otherCtx = createMockContext({ userId: 2002, text: "/mail" });

    await mailCommand(ownerCtx, config, storage as never);
    await mailCommand(otherCtx, config, storage as never);

    expect(ownerCtx.replies[0]).toContain("/mail draft");
    expect(otherCtx.replies[0]).toContain("Mail drafting is owner-restricted");
    expect(otherCtx.replies[0]).not.toContain("prometheus.inference@gmail.com");
  });

  it("parses /mail draft and creates Gmail draft with record and audit", async () => {
    const storage = createMailStorage();
    const gmail = { createDraft: vi.fn(async () => ({ id: "draft-1" })) };
    const ctx = createMockContext({ userId: 1001, text: "/mail draft test@example.com | Meeting Follow-up | Hi, following up." });

    await mailCommand(ctx, config, storage as never, { gmail });

    expect(gmail.createDraft).toHaveBeenCalledWith({ to: ["test@example.com"], subject: "Meeting Follow-up", body: "Hi, following up." });
    expect(storage.mailDrafts.create).toHaveBeenCalledWith(expect.objectContaining({ gmail_draft_id: "draft-1", body_preview: "Hi, following up." }));
    expect(storage.audit.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "gmail_draft_created" }));
    expect(ctx.replies[0]).toContain("Draft created, Sir");
    expect(ctx.replies[0]).toContain("draft-1");
  });

  it("reports missing Gmail OAuth config instead of throwing backend hiccup", async () => {
    const storage = createMailStorage();
    const gmail = { createDraft: vi.fn(async () => { throw new Error("should not call"); }) };
    const ctx = createMockContext({ userId: 1001, text: "/mail draft test@example.com | Subject | Body" });

    await mailCommand(ctx, { ...config, googleClientId: undefined, gmailRefreshToken: undefined }, storage as never, { gmail });

    expect(ctx.replies[0]).toContain("Gmail OAuth is not configured");
    expect(gmail.createDraft).not.toHaveBeenCalled();
  });

  it("reports Gmail draft API failure safely", async () => {
    const storage = createMailStorage();
    const gmail = { createDraft: vi.fn(async () => { throw new GmailApiError("draft_create_failed"); }) };
    const ctx = createMockContext({ userId: 1001, text: "/mail draft test@example.com | Subject | Body" });

    await mailCommand(ctx, config, storage as never, { gmail });

    expect(ctx.replies[0]).toContain("Gmail API could not create the draft");
    expect(ctx.replies[0]).not.toContain("Bearer");
  });

  it("reports draft created even if local draft record storage fails", async () => {
    const storage = createMailStorage();
    storage.mailDrafts.create.mockRejectedValueOnce(new Error("database write failed"));
    const gmail = { createDraft: vi.fn(async () => ({ id: "draft-created-in-gmail" })) };
    const ctx = createMockContext({ userId: 1001, text: "/mail draft test@example.com | Subject | Body" });

    await mailCommand(ctx, config, storage as never, { gmail });

    expect(ctx.replies[0]).toContain("Draft created, Sir");
    expect(ctx.replies[0]).toContain("draft-created-in-gmail");
    expect(ctx.replies[0]).not.toContain("database write failed");
  });

  it("reports Gmail OAuth token refresh failure without exposing secrets", async () => {
    const storage = createMailStorage();
    const gmail = { createDraft: vi.fn(async () => { throw new GmailOAuthError("token_refresh_failed", "invalid_grant"); }) };
    const ctx = createMockContext({ userId: 1001, text: "/mail draft test@example.com | Subject | Body" });

    await mailCommand(ctx, config, storage as never, { gmail });

    expect(ctx.replies[0]).toContain("Gmail OAuth token refresh failed");
    expect(ctx.replies[0]).toContain("Google error: invalid_grant");
    expect(ctx.replies[0]).toContain("current Google client");
    expect(ctx.replies[0]).not.toContain(config.googleClientSecret);
    expect(ctx.replies[0]).not.toContain(config.gmailRefreshToken);
  });

  it("diagnoses Gmail OAuth refresh without exposing secrets", async () => {
    const storage = createMailStorage();
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant", error_description: "sensitive detail" }), { status: 400 })) as never;
    const ctx = createMockContext({ userId: 1001, text: "/mail diagnose" });

    try {
      await mailCommand(ctx, config, storage as never);
    } finally {
      global.fetch = originalFetch;
    }

    expect(ctx.replies[0]).toContain("PROMETHEUS Mail OAuth Diagnose");
    expect(ctx.replies[0]).toContain("Status: failed");
    expect(ctx.replies[0]).toContain("Google error: invalid_grant");
    expect(ctx.replies[0]).not.toContain("sensitive detail");
    expect(ctx.replies[0]).not.toContain(config.googleClientSecret);
    expect(ctx.replies[0]).not.toContain(config.gmailRefreshToken);
  });

  it("diagnoses Gmail OAuth token endpoint network failure safely", async () => {
    const storage = createMailStorage();
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => { throw new Error("connect ECONNRESET"); }) as never;
    const ctx = createMockContext({ userId: 1001, text: "/mail diagnose" });

    try {
      await mailCommand(ctx, config, storage as never);
    } finally {
      global.fetch = originalFetch;
    }

    expect(ctx.replies[0]).toContain("Status: failed");
    expect(ctx.replies[0]).toContain("Google error: network_error");
    expect(ctx.replies[0]).not.toContain("ECONNRESET");
    expect(ctx.replies[0]).not.toContain(config.googleClientSecret);
    expect(ctx.replies[0]).not.toContain(config.gmailRefreshToken);
  });

  it("shows /mail status with config presence only", async () => {
    const storage = createMailStorage();
    const ctx = createMockContext({ userId: 1001, text: "/mail status" });

    await mailCommand(ctx, config, storage as never);

    expect(ctx.replies[0]).toContain("PROMETHEUS Mail Draft Status");
    expect(ctx.replies[0]).toContain("Client ID configured: yes");
    expect(ctx.replies[0]).toContain("Client secret configured: yes");
    expect(ctx.replies[0]).toContain("Refresh token configured: yes");
    expect(ctx.replies[0]).not.toContain(config.googleClientSecret);
    expect(ctx.replies[0]).not.toContain(config.gmailRefreshToken);
  });

  it("validates invalid email empty subject empty body and too many recipients", async () => {
    expect(validateDraftInput({ to: ["bad"], subject: "s", body: "b" })).toMatchObject({ ok: false });
    expect(validateDraftInput({ to: ["a@example.com"], subject: "", body: "b" })).toMatchObject({ ok: false });
    expect(validateDraftInput({ to: ["a@example.com"], subject: "s", body: "" })).toMatchObject({ ok: false });
    expect(validateDraftInput({ to: ["a@e.com", "b@e.com", "c@e.com", "d@e.com", "e@e.com", "f@e.com"], subject: "s", body: "b" })).toMatchObject({ ok: false });
  });

  it("rejects spam phishing and credential collection content before Gmail API", async () => {
    const storage = createMailStorage();
    const gmail = { createDraft: vi.fn(async () => ({ id: "draft-1" })) };
    const ctx = createMockContext({ userId: 1001, text: "/mail draft victim@example.com | Verify account | Send your OTP and password" });

    await mailCommand(ctx, config, storage as never, { gmail });

    expect(ctx.replies[0]).toContain("Message not drafted");
    expect(gmail.createDraft).not.toHaveBeenCalled();
  });

  it("builds RFC 2822 MIME and base64url raw message", () => {
    const mime = buildMimeMessage({
      fromEmail: "prometheus.inference@gmail.com",
      fromName: "PROMETHEUS",
      to: ["test@example.com"],
      subject: "Hello",
      body: "Body"
    });
    const raw = encodeBase64Url(mime);

    expect(mime).toContain("From: PROMETHEUS <prometheus.inference@gmail.com>");
    expect(mime).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(mime).toContain(prometheusMailSignature);
    expect(raw).not.toMatch(/[+/=]/);
  });

  it("does not duplicate PROMETHEUS mail signature", () => {
    const mime = buildMimeMessage({
      fromEmail: "prometheus.inference@gmail.com",
      fromName: "PROMETHEUS",
      to: ["test@example.com"],
      subject: "Hello",
      body: `Body\n\n${prometheusMailSignature}`
    });

    expect(mime.match(/\*\*PROMETHEUS\*\*/g)).toHaveLength(1);
  });

  it("AI draft creates pending preview and confirm creates Gmail draft", async () => {
    const storage = createMailStorage();
    const gmail = { createDraft: vi.fn(async () => ({ id: "draft-ai-1" })) };
    const aiSkill = { buildAiDraft: vi.fn(async () => ({ to: ["example@gmail.com"], subject: "Project Meeting Availability", body: "Are you available tomorrow?" })) };
    const ctx = createMockContext({ userId: 1001, text: "/mail draft_ai example@gmail.com | ask for project meeting availability tomorrow" });

    await mailCommand(ctx, config, storage as never, { gmail, aiSkill });
    expect(ctx.replies[0]).toContain("Draft preview");
    expect(gmail.createDraft).not.toHaveBeenCalled();

    const confirmCtx = createMockContext({ userId: 1001, text: "CONFIRM DRAFT" });
    await handleMailDraftConfirmation(confirmCtx, config, storage as never, { gmail });

    expect(gmail.createDraft).toHaveBeenCalledWith({ to: ["example@gmail.com"], subject: "Project Meeting Availability", body: "Are you available tomorrow?" });
    expect(confirmCtx.replies[0]).toContain("draft-ai-1");
  });

  it("AI draft can cancel and expired pending draft is rejected", async () => {
    const storage = createMailStorage();
    const gmail = { createDraft: vi.fn(async () => ({ id: "draft-ai-1" })) };
    const aiSkill = { buildAiDraft: vi.fn(async () => ({ to: ["example@gmail.com"], subject: "Subject", body: "Body" })) };
    await mailCommand(createMockContext({ userId: 1001, text: "/mail draft_ai example@gmail.com | purpose" }), config, storage as never, { gmail, aiSkill, now: () => 1000 });

    const cancelCtx = createMockContext({ userId: 1001, text: "CANCEL DRAFT" });
    await handleMailDraftConfirmation(cancelCtx, config, storage as never, { gmail, now: () => 2000 });
    expect(cancelCtx.replies[0]).toContain("cancelled");

    await mailCommand(createMockContext({ userId: 1001, text: "/mail draft_ai example@gmail.com | purpose" }), config, storage as never, { gmail, aiSkill, now: () => 1000 });
    const expiredCtx = createMockContext({ userId: 1001, text: "CONFIRM DRAFT" });
    await handleMailDraftConfirmation(expiredCtx, config, storage as never, { gmail, now: () => 11 * 60 * 1000 });
    expect(expiredCtx.replies[0]).toContain("expired");
  });

  it("Groq failure returns safe fallback for draft_ai", async () => {
    const storage = createMailStorage();
    const ctx = createMockContext({ userId: 1001, text: "/mail draft_ai example@gmail.com | purpose" });
    const aiSkill = { buildAiDraft: vi.fn(async () => { throw new Error("groq down"); }) };

    await mailCommand(ctx, config, storage as never, { aiSkill });

    expect(ctx.replies[0]).toContain("I could not draft with Groq");
  });

  it("lists previews and discards recorded drafts without send API", async () => {
    const storage = createMailStorage();
    const gmail = { createDraft: vi.fn(async () => ({ id: "draft-1" })), deleteDraft: vi.fn(async () => undefined), send: vi.fn() };
    await mailCommand(createMockContext({ userId: 1001, text: "/mail draft test@example.com | Subject | Body" }), config, storage as never, { gmail });

    const listCtx = createMockContext({ userId: 1001, text: "/mail drafts" });
    await mailCommand(listCtx, config, storage as never, { gmail });
    expect(listCtx.replies[0]).toContain("draft-1");

    const previewCtx = createMockContext({ userId: 1001, text: "/mail preview draft-1" });
    await mailCommand(previewCtx, config, storage as never, { gmail });
    expect(previewCtx.replies[0]).toContain("Body preview");

    const discardCtx = createMockContext({ userId: 1001, text: "/mail discard draft-1" });
    await mailCommand(discardCtx, config, storage as never, { gmail });
    expect(gmail.deleteDraft).toHaveBeenCalledWith("draft-1");
    expect(gmail.send).not.toHaveBeenCalled();
  });

  it("lists live Gmail drafts and sends a draft by number", async () => {
    const storage = createMailStorage();
    const gmail = {
      createDraft: vi.fn(async () => ({ id: "draft-1" })),
      listDrafts: vi.fn(async () => [
        { id: "draft-new", subject: "Newest", to: "test@example.com", snippet: "Body", internalDate: 2000 },
        { id: "draft-old", subject: "Older", to: "test@example.com", snippet: "Body", internalDate: 1000 }
      ]),
      sendDraft: vi.fn(async (draftId: string) => ({ draftId, messageId: "message-1" }))
    };

    const listCtx = createMockContext({ userId: 1001, text: "/mail drafts" });
    await mailCommand(listCtx, config, storage as never, { gmail });
    expect(listCtx.replies[0]).toContain("1. Newest");
    expect(listCtx.replies[0]).toContain("/mail send <number>");

    const sendCtx = createMockContext({ userId: 1001, text: "/mail send 1" });
    await mailCommand(sendCtx, config, storage as never, { gmail });

    expect(gmail.sendDraft).toHaveBeenCalledWith("draft-new");
    expect(storage.mailDrafts.markSent).toHaveBeenCalledWith(config.ownerTelegramId, "draft-new");
    expect(sendCtx.replies[0]).toContain("Draft sent, Sir");
    expect(sendCtx.replies[0]).toContain("message-1");
  });

  it("GmailClient sends drafts through Gmail drafts.send endpoint", async () => {
    const originalFetch = global.fetch;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "sent-message-1" }), { status: 200 }));
    global.fetch = fetchMock as never;

    try {
      const client = new GmailClient(config);
      const result = await client.sendDraft("draft-123");

      expect(result).toEqual({ draftId: "draft-123", messageId: "sent-message-1" });
      expect(fetchMock).toHaveBeenNthCalledWith(2, "https://gmail.googleapis.com/gmail/v1/users/me/drafts/send", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ id: "draft-123" })
      }));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

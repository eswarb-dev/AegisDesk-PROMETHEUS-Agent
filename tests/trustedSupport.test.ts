import { describe, expect, it } from "vitest";
import { privacyCommand } from "../src/commands/privacy.js";
import { supportCommand } from "../src/commands/support.js";
import { TrustedSupportService } from "../src/support/trustedSupportService.js";
import { createMockContext } from "./helpers.js";

const config = { ownerTelegramId: "1001", groqModel: "test", groqApiKey: "test" };

function createStorage(options: { lastMediumAlertAt?: string | null } = {}) {
  const supportEvents: unknown[] = [];
  const ownerAlerts: Array<{ id: string; created_at: string; severity: string; contact_id: string; title: string }> = [];
  return {
    kind: "supabase",
    conversations: {
      updateConversationSummary: async (input: unknown) => input
    },
    support: {
      createSupportEvent: async (input: unknown) => {
        supportEvents.push(input);
        return input;
      },
      getRecentSupportEvents: async () => supportEvents,
      getRecentEventsForContact: async () => [],
      getLastOwnerAlert: async (_contactId: string, severity?: string) =>
        severity === "medium" && options.lastMediumAlertAt
          ? { created_at: options.lastMediumAlertAt, severity: "medium", contact_id: "aksharaa" }
          : severity === "high" && options.lastMediumAlertAt
          ? { created_at: options.lastMediumAlertAt, severity: "high", contact_id: "aksharaa" }
          : null,
      createOwnerAlert: async (input: { severity: string; contact_id: string; title: string }) => {
        const alert = { ...input, id: "alert-1", created_at: new Date().toISOString() };
        ownerAlerts.push(alert);
        return alert;
      },
      markOwnerAlertDelivered: async () => undefined,
      getOwnerAlerts: async () => ownerAlerts
    },
    _supportEvents: supportEvents,
    _ownerAlerts: ownerAlerts
  };
}

function contact() {
  return { contactId: "aksharaa", telegramUserId: "2002", chatId: "2002", displayName: "Aksharaa" };
}

describe("trusted support mode", () => {
  it("medium distress creates a support event and natural support response", async () => {
    const storage = createStorage();
    const telegram = { sendMessage: async () => undefined };
    const groq = { chat: async () => "I’m here with you. Tell me slowly what happened." };
    const service = new TrustedSupportService(config, storage as never, groq);

    const reply = await service.handleMessage({ contact: contact(), text: "I feel bad today", telegram: telegram as never });

    expect(reply).toContain("Tell me slowly");
    expect(storage._supportEvents[0]).toMatchObject({ emotional_state: "emotionally_distressed", severity: "medium", owner_notified: true });
  });

  it("high distress sends owner DM", async () => {
    const storage = createStorage();
    const sent: string[] = [];
    const telegram = { sendMessage: async (_chatId: string, message: string) => sent.push(message) };
    const service = new TrustedSupportService(config, storage as never, { chat: async () => "That sounds heavy. Eswar might be safe to tell." });

    await service.handleMessage({ contact: contact(), text: "I can't handle this", telegram: telegram as never });

    expect(sent[0]).toContain("PROMETHEUS Support Alert");
    expect(sent[0]).toContain("Scope:");
    expect(sent[0]).not.toContain("full conversation");
  });

  it("medium alert cooldown prevents repeated owner alerts", async () => {
    const storage = createStorage({ lastMediumAlertAt: new Date().toISOString() });
    const sent: string[] = [];
    const telegram = { sendMessage: async (_chatId: string, message: string) => sent.push(message) };
    const service = new TrustedSupportService(config, storage as never, { chat: async () => "I’m here. Tell me slowly." });

    await service.handleMessage({ contact: contact(), text: "No one understands", telegram: telegram as never });

    expect(sent).toHaveLength(0);
    expect(storage._supportEvents[0]).toMatchObject({ owner_notified: false });
  });

  it("crisis wording triggers immediate owner alert and safety reply", async () => {
    const storage = createStorage({ lastMediumAlertAt: new Date().toISOString() });
    const sent: string[] = [];
    const telegram = { sendMessage: async (_chatId: string, message: string) => sent.push(message) };
    const service = new TrustedSupportService(config, storage as never, { chat: async () => { throw new Error("use fallback"); } });

    const reply = await service.handleMessage({ contact: contact(), text: "I want to kill myself", telegram: telegram as never });

    expect(reply).toContain("Please don’t stay alone");
    expect(sent[0]).toContain("crisis_risk");
  });

  it("deduplicates repeated high alerts briefly", async () => {
    const storage = createStorage({ lastMediumAlertAt: new Date().toISOString() });
    const sent: string[] = [];
    const telegram = { sendMessage: async (_chatId: string, message: string) => sent.push(message) };
    const service = new TrustedSupportService(config, storage as never, { chat: async () => "I’m here." });

    await service.handleMessage({ contact: contact(), text: "I can't handle this", telegram: telegram as never });

    expect(sent).toHaveLength(0);
    expect(storage._supportEvents[0]).toMatchObject({ severity: "high", owner_notified: false });
  });

  it("lonely trusted contact fallback gently suggests starting small with Eswar", async () => {
    const storage = createStorage();
    const telegram = { sendMessage: async () => undefined };
    const service = new TrustedSupportService(config, storage as never, { chat: async () => { throw new Error("use fallback"); } });

    const reply = await service.handleMessage({ contact: contact(), text: "I feel alone and I don't know whom to talk to", telegram: telegram as never });

    expect(reply).toContain("start small with Eswar");
    expect(reply).toContain("not fully okay");
    expect(reply).not.toMatch(/must message Eswar|definitely fix|only person/i);
  });

  it("owner alert tone gives Eswar a simple suggested opening", async () => {
    const storage = createStorage();
    const sent: string[] = [];
    const telegram = { sendMessage: async (_chatId: string, message: string) => sent.push(message) };
    const service = new TrustedSupportService(config, storage as never, { chat: async () => "I’m here with you." });

    await service.handleMessage({ contact: contact(), text: "No one understands", telegram: telegram as never });

    expect(sent[0]).toContain("Aksharaa seems emotionally low");
    expect(sent[0]).toContain("Hey, I’m here. You don’t have to explain everything at once.");
    expect(sent[0]).toContain("This is based only on their conversation with PROMETHEUS");
  });

  it("owner can view /support and trusted privacy explains alert behavior", async () => {
    const storage = createStorage();
    storage._supportEvents.push({
      contact_id: "aksharaa",
      emotional_state: "sad",
      severity: "low",
      safe_summary: "Aksharaa shared a sad mood.",
      created_at: "2026-08-11T10:00:00Z"
    });
    const supportCtx = createMockContext({ userId: 1001, text: "/support" });
    await supportCommand(supportCtx, config, storage as never);
    expect(supportCtx.replies[0]).toContain("Trusted support events");

    const privacyCtx = createMockContext({ userId: 2002, text: "/privacy" });
    await privacyCommand(privacyCtx);
    expect(privacyCtx.replies[0]).toContain("summarize emotional distress to Eswar");
  });

  it("non-owner cannot view /support", async () => {
    const ctx = createMockContext({ userId: 2002, text: "/support" });

    await supportCommand(ctx, config, createStorage() as never);

    expect(ctx.replies[0]).toContain("owner-restricted");
  });
});

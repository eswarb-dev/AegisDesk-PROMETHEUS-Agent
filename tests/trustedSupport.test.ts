import { describe, expect, it } from "vitest";
import { privacyCommand } from "../src/commands/privacy.js";
import { supportCommand } from "../src/commands/support.js";
import { TrustedSupportService } from "../src/support/trustedSupportService.js";
import { createMockContext } from "./helpers.js";

const config = { ownerTelegramId: "1001", groqModel: "test", groqApiKey: "test" };

function createStorage(options: { lastMediumAlertAt?: string | null; recentEvents?: Array<{ severity: string; emotional_state: string }> } = {}) {
  const supportEvents: unknown[] = [];
  const ownerAlerts: Array<{ id: string; created_at: string; severity: string; contact_id: string; title: string }> = [];
  return {
    kind: "supabase",
    conversations: {
      updateConversationSummary: async (input: unknown) => input
    },
    memories: {
      getSubjectInternalMemories: async (contactId: string) => contactId === "vathanya" ? [
        {
          subject_key: "vathanya_support_style",
          summary: "Listen first, validate emotion, then gently separate control from acceptance and boundaries.",
          content: "Private Vathanya support style"
        },
        {
          subject_key: "vathanya_communication_style",
          summary: "Use natural, casual, emotionally warm replies; avoid formal counselling style.",
          content: "Private Vathanya communication style"
        }
      ] : contactId === "aksharaa" ? [
        {
          subject_key: "aksharaa_school_crush_context",
          summary: "Her boyfriend reference usually means a school-time crush, not a committed boyfriend.",
          content: "Private Aksharaa relationship context"
        },
        {
          subject_key: "aksharaa_support_style",
          summary: "Validate first, then separate facts, assumptions, hopes, and current actions.",
          content: "Private Aksharaa support style"
        },
        {
          subject_key: "aksharaa_academic_support_style",
          summary: "For placements, use small concrete tasks and visible progress.",
          content: "Private Aksharaa academic style"
        },
        {
          subject_key: "aksharaa_coding_confidence",
          summary: "Use small achievable coding learning steps instead of overwhelming plans.",
          content: "Private Aksharaa coding confidence"
        }
      ] : []
    },
    support: {
      createSupportEvent: async (input: unknown) => {
        supportEvents.push(input);
        return input;
      },
      getRecentSupportEvents: async () => supportEvents,
      getRecentEventsForContact: async () => options.recentEvents ?? [],
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

function vathanya() {
  return { contactId: "vathanya", telegramUserId: "5559225697", chatId: "5559225697", displayName: "Vathanya" };
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

  it("Vathanya support reply prompt uses private subject context without disclosing it", async () => {
    const storage = createStorage();
    const telegram = { sendMessage: async () => undefined };
    const groq = {
      chat: async (messages: Array<{ content: string }>) => {
        const prompt = messages.map((message) => message.content).join("\n");
        expect(prompt).toContain("vathanya_support_style");
        expect(prompt).toMatch(/validate emotion/i);
        expect(prompt).toContain("non-disclosable");
        return "Yeah, I get why that would affect you. Knowing it logically and accepting it emotionally are different things.";
      }
    };
    const service = new TrustedSupportService(config, storage as never, groq);

    const reply = await service.handleMessage({ contact: vathanya(), text: "People leave and it affects me", telegram: telegram as never });

    expect(reply).toContain("accepting it emotionally");
    expect(reply).not.toMatch(/memory|profile|stored/i);
  });

  it("Vathanya depression wording sends owner alert with what why and how she feels", async () => {
    const storage = createStorage();
    const sent: string[] = [];
    const telegram = { sendMessage: async (_chatId: string, message: string) => sent.push(message) };
    const service = new TrustedSupportService(config, storage as never, { chat: async () => "I’m here with you. Let’s take this slowly." });

    await service.handleMessage({ contact: vathanya(), text: "I feel depression and I keep overthinking", telegram: telegram as never });

    expect(sent[0]).toContain("Vathanya seems highly distressed");
    expect(sent[0]).toContain("What they said:");
    expect(sent[0]).toContain("Why it matters:");
    expect(sent[0]).toContain("How she may be feeling:");
    expect(sent[0]).toContain("Scope:");
    expect(storage._supportEvents[0]).toMatchObject({ contact_id: "vathanya", owner_notified: true });
  });

  it("Aksharaa relationship support uses school-crush context without inventing commitment", async () => {
    const storage = createStorage();
    const telegram = { sendMessage: async () => undefined };
    const groq = {
      chat: async (messages: Array<{ content: string }>) => {
        const prompt = messages.map((message) => message.content).join("\n");
        expect(prompt).toContain("aksharaa_school_crush_context");
        expect(prompt).toContain("school-time crush");
        expect(prompt).toContain("facts, assumptions, hopes");
        return "I can't know what's inside his head. Let's separate the fact, your hope, and what he's actually doing right now.";
      }
    };
    const service = new TrustedSupportService(config, storage as never, groq);

    const reply = await service.handleMessage({ contact: contact(), text: "My boyfriend left me on seen again", telegram: telegram as never });

    expect(reply).toContain("what he's actually doing");
    expect(reply).not.toMatch(/definitely loves you|will come back|committed boyfriend/i);
  });

  it("support mode rejects hallucinated question-heavy Groq replies", async () => {
    const storage = createStorage();
    const telegram = { sendMessage: async () => undefined };
    const service = new TrustedSupportService(config, storage as never, {
      chat: async () => "He definitely loves you. Why did he do that? What will you do now?"
    });

    const reply = await service.handleMessage({ contact: contact(), text: "My boyfriend left me on seen again", telegram: telegram as never });

    expect(reply).not.toContain("definitely loves you");
    expect(reply.match(/\?/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it("Aksharaa placement anxiety creates support event and practical reply path", async () => {
    const storage = createStorage();
    const telegram = { sendMessage: async () => undefined };
    const groq = {
      chat: async (messages: Array<{ content: string }>) => {
        const prompt = messages.map((message) => message.content).join("\n");
        expect(prompt).toContain("aksharaa_academic_support_style");
        expect(prompt).toContain("aksharaa_coding_confidence");
        expect(prompt).not.toContain("aksharaa_school_crush_context");
        return "First breathe. Then we split placements into one coding step for today.";
      }
    };
    const service = new TrustedSupportService(config, storage as never, groq);

    const reply = await service.handleMessage({ contact: contact(), text: "I am scared about placements and coding", telegram: telegram as never });

    expect(reply).toContain("one coding step");
    expect(storage._supportEvents[0]).toMatchObject({ contact_id: "aksharaa", severity: "medium" });
  });

  it("continued Vathanya low-mood chat can trigger owner alert after recent emotional support events", async () => {
    const storage = createStorage({
      recentEvents: [
        { severity: "low", emotional_state: "sad" },
        { severity: "low", emotional_state: "lonely" }
      ]
    });
    const sent: string[] = [];
    const telegram = { sendMessage: async (_chatId: string, message: string) => sent.push(message) };
    const service = new TrustedSupportService(config, storage as never, { chat: async () => "I’m here. We can go slowly." });

    await service.handleMessage({ contact: vathanya(), text: "I'm fine", telegram: telegram as never });

    expect(sent[0]).toContain("Vathanya seems emotionally low");
    expect(storage._supportEvents[0]).toMatchObject({ severity: "low", owner_notified: true });
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

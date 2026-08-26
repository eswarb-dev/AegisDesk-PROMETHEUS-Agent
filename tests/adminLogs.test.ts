import { describe, expect, it } from "vitest";
import { answerOwnerLogQuestion, chatCommand, exportCommand, logsCommand } from "../src/commands/adminLogs.js";
import { redactSecrets } from "../src/utils/redactSecrets.js";
import { createMockContext } from "./helpers.js";

const config = { ownerTelegramId: "1001" };

function createSupabaseStorage() {
  const auditLogs: unknown[] = [];
  return {
    kind: "supabase",
    admin: {
      getUsers: async () => [],
      getContacts: async () => [],
      getPendingUsers: async () => [],
      getAuditLogs: async () => auditLogs,
      writeAuditLog: async (input: unknown) => {
        auditLogs.push(input);
      }
    },
    contacts: {
      list: async () => ({
        trusted_contacts: [
          { id: "aksharaa", name: "Aksharaa", telegram_user_id: 2002 },
          { id: "vathanya", name: "Vathanya", telegram_user_id: null },
          { id: "maddhurika", name: "Maddhurika", telegram_user_id: null }
        ],
        pending_users: []
      })
    },
    users: {
      getTelegramUserById: async (id: string | number) => id === 2002 ? { telegram_user_id: "2002", role: "trusted_contact", contact_id: "aksharaa" } : null,
      getTelegramUserByContactId: async (contactId: string) => contactId === "vathanya" ? { telegram_user_id: "3003", role: "trusted_contact", contact_id: "vathanya" } : null
    },
    conversations: {
      getConversationSummary: async () => ({ short_summary: "Asked about Eswar safely." })
    },
    messages: {
      getRecentMessages: async () => [
        { telegram_user_id: "2002", chat_id: "2002", role: "trusted_contact", contact_id: "aksharaa", direction: "inbound", message_type: "text", text_redacted: "How is Eswar?", created_at: "2026-08-11T10:00:00Z" },
        { telegram_user_id: "2002", chat_id: "2002", role: "trusted_contact", contact_id: "aksharaa", direction: "outbound", message_type: "text", text_redacted: "I can only share what Eswar allowed.", created_at: "2026-08-11T10:01:00Z" }
      ],
      getMessagesByContactId: async (contactId: string) => {
        if (contactId === "vathanya") {
          return [
            { telegram_user_id: "3003", chat_id: "3003", role: "trusted_contact", contact_id: "vathanya", direction: "outbound", message_type: "owner_relay", text_redacted: "Let me know about the birthday plan 😂", sender_role: "owner", sender_label: "owner_via_prometheus", source_command: "tell", owner_initiated: true, created_at: "2026-08-11T10:00:00Z" },
            { telegram_user_id: "3003", chat_id: "3003", role: "trusted_contact", contact_id: "vathanya", direction: "inbound", message_type: "text", text_redacted: "😭😭", created_at: "2026-08-11T10:01:00Z" },
            { telegram_user_id: "3003", chat_id: "3003", role: "trusted_contact", contact_id: "vathanya", direction: "outbound", message_type: "text", text_redacted: "That crying emoji says you got caught 😭😂", created_at: "2026-08-11T10:02:00Z" }
          ];
        }
        return contactId === "aksharaa" ? [
          { telegram_user_id: "2002", chat_id: "2002", role: "trusted_contact", contact_id: "aksharaa", direction: "inbound", message_type: "text", text_redacted: "How is Eswar?", created_at: "2026-08-11T10:00:00Z" },
          { telegram_user_id: "2002", chat_id: "2002", role: "trusted_contact", contact_id: "aksharaa", direction: "outbound", message_type: "text", text_redacted: "I can only share what Eswar allowed.", created_at: "2026-08-11T10:01:00Z" }
        ] : [];
      },
      searchMessages: async () => [],
      searchMessagesByContactId: async () => [],
      getLatestMessageForContact: async (contactId: string) => contactId === "aksharaa" ? { text_redacted: "How is Eswar?", created_at: "2026-08-11T10:00:00Z" } : null,
      getMessagesToday: async () => [],
      exportMessages: async () => [
        { direction: "inbound", text_redacted: "hello", created_at: "2026-08-11T10:00:00Z" }
      ],
      deleteUserMessages: async () => undefined
    }
  };
}

describe("owner-scoped admin logs", () => {
  it("blocks non-owner log commands without revealing log existence", async () => {
    const ctx = createMockContext({ userId: 2002, text: "/logs" });

    await logsCommand(ctx, config, createSupabaseStorage() as never);

    expect(ctx.replies[0]).toContain("owner-restricted");
    expect(ctx.replies[0]).not.toContain("logs");
  });

  it("owner can view trusted contact chat logs", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/chat aksharaa" });

    await chatCommand(ctx, config, createSupabaseStorage() as never);

    expect(ctx.replies[0]).toContain("Aksharaa");
    expect(ctx.replies[0]).toContain("How is Eswar?");
    expect(ctx.replies[0]).toContain("PROMETHEUS");
  });

  it("/chat labels owner relay messages chronologically", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/chat vathanya" });

    await chatCommand(ctx, config, createSupabaseStorage() as never);

    expect(ctx.replies[0]).toContain("OWNER via PROMETHEUS");
    expect(ctx.replies[0]).toContain("Let me know about the birthday plan");
    expect(ctx.replies[0]).toContain("Vathanya");
    expect(ctx.replies[0]).toContain("😭😭");
    expect(ctx.replies[0]).toContain("That crying emoji says you got caught");
    expect(ctx.replies[0].indexOf("OWNER via PROMETHEUS")).toBeLessThan(ctx.replies[0].indexOf("😭😭"));
  });

  it("export includes bot-only scope disclaimer", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/export aksharaa" });

    await exportCommand(ctx, config, createSupabaseStorage() as never);

    expect(ctx.replies[0]).toContain("PROMETHEUS Bot Conversation Export");
    expect(ctx.replies[0]).toContain("Scope: messages inside @AegisDesk_PrometheusBot only");
  });

  it("natural owner question checks contact bot conversation history", async () => {
    const ctx = createMockContext({ userId: 1001, text: "Did Vathanya talk to you?" });

    const handled = await answerOwnerLogQuestion("Did Vathanya talk to you?", ctx, config, createSupabaseStorage() as never);

    expect(handled).toBe(true);
    expect(ctx.replies[0]).toContain("Yes, Vathanya talked to me inside this bot");
    expect(ctx.replies[0]).toContain("That crying emoji says you got caught");
  });

  it("does not intercept owner storytelling about trusted contacts as log retrieval", async () => {
    const text = "while after college hours me vathanya and aksharaa entered elevator and aksharaa said eswarrr help which made me feel like protector";
    const ctx = createMockContext({ userId: 1001, text });

    const handled = await answerOwnerLogQuestion(text, ctx, config, createSupabaseStorage() as never);

    expect(handled).toBe(false);
    expect(ctx.replies).toHaveLength(0);
  });

  it("redacts secrets before storage", () => {
    expect(redactSecrets("password: hunter2 and token=abc123456789012345678901")).toContain("[REDACTED_SECRET]");
    expect(redactSecrets("OTP code 123456")).toContain("[REDACTED_SECRET]");
  });
});

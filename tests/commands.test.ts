import { describe, expect, it, vi } from "vitest";
import { aboutCommand } from "../src/commands/about.js";
import { contactsCommand } from "../src/commands/contacts.js";
import { helpCommand } from "../src/commands/help.js";
import { memoryCommand } from "../src/commands/memory.js";
import { pingCommand } from "../src/commands/ping.js";
import { startCommand } from "../src/commands/start.js";
import { tellCommand } from "../src/commands/tell.js";
import { trustCommand } from "../src/commands/trust.js";
import { untrustCommand } from "../src/commands/untrust.js";
import { whoamiCommand } from "../src/commands/whoami.js";
import { MemoryStore } from "../src/memory/memoryStore.js";
import { createMockContext } from "./helpers.js";

const config = { ownerTelegramId: "1001" };

describe("PROMETHEUS commands", () => {
  it("/start detects owner and stores user", async () => {
    const store = new MemoryStore();
    const ctx = createMockContext({ userId: 1001, text: "/start", username: "eswar" });

    await startCommand(ctx, config, store);

    expect(ctx.replies[0]).toContain("Personalised memory mode active");
    expect(store.getTelegramUser(1001)?.role).toBe("owner");
  });

  it("/start limits non-owner", async () => {
    const store = new MemoryStore();
    const ctx = createMockContext({ userId: 2002, text: "/start" });

    await startCommand(ctx, config, store);

    expect(ctx.replies[0]).toContain("owner-restricted");
    expect(store.getTelegramUser(2002)?.role).toBe("pending");
  });

  it("/help returns public chatbot commands only by default", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/help" });

    await helpCommand(ctx);

    expect(ctx.replies[0]).toContain("/privacy");
    expect(ctx.replies[0]).not.toContain("/memory");
    expect(ctx.replies[0]).not.toContain("/lock");
    expect(ctx.replies[0]).not.toContain("/shutdown");
  });

  it("/about states agent identity and no device control", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/about" });

    await aboutCommand(ctx);

    expect(ctx.replies[0]).toContain("Personalised Agent to Eswar B");
    expect(ctx.replies[0]).toContain("AEGISDESK // AGENT SYSTEM");
    expect(ctx.replies[0]).toContain("No device control");
  });

  it("/ping returns latency", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/ping" });

    await pingCommand(ctx);

    expect(ctx.replies[0]).toContain("PROMETHEUS online");
    expect(ctx.replies[0]).toMatch(/Latency: \d+ ms/);
  });

  it("/memory is owner only", async () => {
    const store = new MemoryStore();
    const ctx = createMockContext({ userId: 2002, text: "/memory" });

    await memoryCommand(ctx, config, store);

    expect(ctx.replies[0]).toContain("owner-only");
  });

  it("/memory shows status for owner", async () => {
    const store = new MemoryStore();
    const ctx = createMockContext({ userId: 1001, text: "/memory" });

    await memoryCommand(ctx, config, store);

    expect(ctx.replies[0]).toContain("Memory: active");
    expect(ctx.replies[0]).toContain("Fallback mode: available");
  });

  it("owner management commands are owner only", async () => {
    const service = {
      list: async () => ({ trusted_contacts: [], pending_users: [] }),
      approve: async () => {
        throw new Error("should not approve");
      },
      revoke: async () => {
        throw new Error("should not revoke");
      }
    };

    const contactsCtx = createMockContext({ userId: 2002, text: "/contacts" });
    await contactsCommand(contactsCtx, config, service as never);
    expect(contactsCtx.replies[0]).toContain("Owner-only");

    const trustCtx = createMockContext({ userId: 2002, text: "/trust 2002 aksharaa" });
    await trustCommand(trustCtx, config, service as never);
    expect(trustCtx.replies[0]).toContain("Owner-only");

    const untrustCtx = createMockContext({ userId: 2002, text: "/untrust aksharaa" });
    await untrustCommand(untrustCtx, config, service as never);
    expect(untrustCtx.replies[0]).toContain("Owner-only");
  });

  it("/contacts shows telegram id, chat availability, and message enabled status", async () => {
    const service = {
      list: async () => ({
        trusted_contacts: [
          { name: "Vathanya", username: "v", telegram_user_id: 5559225697, chat_id: null, enabled: true },
          { name: "Aksharaa", username: "a", telegram_user_id: 7832757601, chat_id: 7832757601, enabled: true }
        ],
        pending_users: []
      })
    };
    const ctx = createMockContext({ userId: 1001, text: "/contacts" });

    await contactsCommand(ctx, config, service as never);

    expect(ctx.replies[0]).toContain("Telegram ID: 5559225697");
    expect(ctx.replies[0]).toContain("Chat ID: missing");
    expect(ctx.replies[0]).toContain("Message enabled: no");
    expect(ctx.replies[0]).toContain("Message enabled: yes");
  });

  it("/tell can only be executed by owner", async () => {
    const service = { sendMessage: async () => undefined };
    const ctx = createMockContext({ userId: 2002, text: "/tell aksharaa hello" });

    await tellCommand(ctx, config, service as never);

    expect(ctx.replies[0]).toContain("owner-restricted");
  });

  it("/tell refuses contacts without chat_id", async () => {
    const service = {
      sendMessage: async () => {
        throw new Error("Contact is not enabled or has no chat_id for messages.");
      }
    };
    const ctx = createMockContext({ userId: 1001, text: "/tell aksharaa hello" });

    await tellCommand(ctx, config, service as never);

    expect(ctx.replies[0]).toContain("chat_id");
  });

  it("/tell sends simple owner message through Supabase contact and stores outbound", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/tell vathanya 👋" });
    const storage = createTellStorage({ chatId: 555, notificationEnabled: false });

    await tellCommand(ctx, config, { sendMessage: async () => undefined } as never, storage as never);

    expect(ctx.sentMessages[0]).toMatchObject({ chatId: 555 });
    expect(ctx.sentMessages[0].text).toContain("👋");
    expect(ctx.replies[0]).toContain("Sent to Vathanya");
    expect(storage.messages.storeOutboundMessage).toHaveBeenCalled();
  });

  it("/send_message alias behaves like /tell", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/send_message vathanya hi" });
    const storage = createTellStorage({ chatId: 555 });

    await tellCommand(ctx, config, { sendMessage: async () => undefined } as never, storage as never);

    expect(ctx.sentMessages[0].text).toContain("hi");
    expect(ctx.replies[0]).toContain("Sent to Vathanya");
  });

  it("/tell explains missing chat_id and repairs from telegram_users when available", async () => {
    const missingCtx = createMockContext({ userId: 1001, text: "/tell vathanya hi" });
    const missingStorage = createTellStorage({ chatId: null });

    await tellCommand(missingCtx, config, { sendMessage: async () => undefined } as never, missingStorage as never);
    expect(missingCtx.replies[0]).toContain("chat_id is missing");

    const repairedCtx = createMockContext({ userId: 1001, text: "/tell vathanya hi" });
    const repairedStorage = createTellStorage({ chatId: 777, repaired: true });

    await tellCommand(repairedCtx, config, { sendMessage: async () => undefined } as never, repairedStorage as never);
    expect(repairedCtx.sentMessages[0]).toMatchObject({ chatId: 777 });
  });

  it("/trust reports already linked and replace instruction from Supabase", async () => {
    const alreadyCtx = createMockContext({ userId: 1001, text: "/trust 5559225697 vathanya" });
    const alreadyStorage = {
      kind: "supabase",
      contacts: {
        findByContactId: async () => ({ telegram_user_id: 5559225697, enabled: true }),
        link: async () => ({ id: "vathanya", name: "Vathanya", telegram_user_id: 5559225697, enabled: true, chat_id: 5559225697 })
      },
      audit: { writeAuditLog: async () => undefined }
    };
    await trustCommand(alreadyCtx, config, { approve: async () => undefined } as never, alreadyStorage as never);
    expect(alreadyCtx.replies[0]).toContain("already linked");

    const replaceCtx = createMockContext({ userId: 1001, text: "/trust 123 vathanya" });
    const replaceStorage = {
      kind: "supabase",
      contacts: {
        findByContactId: async () => ({ telegram_user_id: 5559225697, enabled: true }),
        link: async () => {
          throw new Error("vathanya is already linked to 5559225697.\nUse:\n/trust --replace 123 vathanya");
        }
      },
      audit: { writeAuditLog: async () => undefined }
    };
    await trustCommand(replaceCtx, config, { approve: async () => undefined } as never, replaceStorage as never);
    expect(replaceCtx.replies[0]).toContain("/trust --replace 123 vathanya");
  });

  it("/whoami returns Telegram ID and owner match", async () => {
    const service = { resolveRole: async () => ({ role: "owner" }) };
    const ctx = createMockContext({ userId: 1001, chatId: 9001, text: "/whoami", username: "eswar" });

    await whoamiCommand(ctx, service as never, config);

    expect(ctx.replies[0]).toContain("Telegram ID: 1001");
    expect(ctx.replies[0]).toContain("Chat ID: 9001");
    expect(ctx.replies[0]).toContain("Owner match: true");
  });
});

function createTellStorage(options: { chatId: number | null; notificationEnabled?: boolean; repaired?: boolean }) {
  return {
    kind: "supabase",
    contacts: {
      repairChatIdFromTelegramUser: async () => ({
        id: "vathanya",
        name: "Vathanya",
        telegram_user_id: 5559225697,
        chat_id: options.chatId,
        username: "vathanya",
        enabled: true,
        permissions: {
          receive_agent_messages: Boolean(options.notificationEnabled),
          receive_wellbeing_updates: Boolean(options.notificationEnabled)
        }
      })
    },
    messages: {
      storeOutboundMessage: vi.fn()
    }
  };
}

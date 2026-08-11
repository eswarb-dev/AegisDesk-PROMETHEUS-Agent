import { describe, expect, it } from "vitest";
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

  it("/help returns chatbot commands only", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/help" });

    await helpCommand(ctx);

    expect(ctx.replies[0]).toContain("/memory");
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

  it("/tell can only be executed by owner", async () => {
    const service = { sendMessage: async () => undefined };
    const ctx = createMockContext({ userId: 2002, text: "/tell aksharaa hello" });

    await tellCommand(ctx, config, service as never);

    expect(ctx.replies[0]).toContain("Owner-only");
  });

  it("/tell refuses contacts without chat_id", async () => {
    const service = {
      sendMessage: async () => {
        throw new Error("Contact is not enabled or has no chat_id for messages.");
      }
    };
    const ctx = createMockContext({ userId: 1001, text: "/tell aksharaa hello" });

    await tellCommand(ctx, config, service as never);

    expect(ctx.replies[0]).toContain("no chat_id");
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

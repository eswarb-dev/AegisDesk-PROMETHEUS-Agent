import { describe, expect, it, vi } from "vitest";
import { registerMessageRouter } from "../src/telegram/messageRouter.js";
import { recordOwnerSupportAlert } from "../src/support/ownerAlertContext.js";
import { createMockContext } from "./helpers.js";

const config = {
  ownerTelegramId: "1001",
  coding: { enabled: false }
};

function createBotHarness() {
  let handler: ((ctx: ReturnType<typeof createMockContext>) => Promise<void>) | undefined;
  return {
    bot: {
      on: (_filter: unknown, callback: typeof handler) => {
        handler = callback;
      }
    },
    async dispatch(ctx: ReturnType<typeof createMockContext>) {
      if (!handler) throw new Error("handler not registered");
      await handler(ctx);
    }
  };
}

describe("Telegram message router owner alert integration", () => {
  it("resolves owner who follow-up from last support alert context", async () => {
    const harness = createBotHarness();
    const brain = { respond: vi.fn(async () => "normal response") };
    registerMessageRouter(harness.bot as never, brain as never, undefined, config as never);
    recordOwnerSupportAlert({
      type: "trusted_support",
      contactId: "aksharaa",
      telegramUserId: "2002",
      createdAt: new Date().toISOString(),
      alertId: "alert-1"
    });

    const ctx = createMockContext({ userId: 1001, text: "who?" });
    await harness.dispatch(ctx);

    expect(ctx.replies).toEqual(["That was Aksharaa, Sir."]);
    expect(brain.respond).not.toHaveBeenCalled();
  });

  it("does not route long owner Monica story through owner log shortcut", async () => {
    const harness = createBotHarness();
    const brain = { respond: vi.fn(async () => "Monica Groq response") };
    const storage = {
      kind: "supabase",
      users: { getTelegramUserById: async () => ({ role: "owner" }) },
      conversations: { updateConversationSummary: async () => undefined },
      styles: { getProfile: async () => null },
      messages: { getRecentMessagesByTelegramUserId: async () => [] }
    };
    registerMessageRouter(harness.bot as never, brain as never, storage as never, config as never);
    const text = [
      "Monica is my friend and this is mainly about friendship reciprocity.",
      "She trusted me with personal problems and I supported her emotionally.",
      "Now I feel left behind because I am usually the one checking on her.",
      "She has her male best friend and Durga around her, and private Instagram became one detail in that feeling.",
      "The thing hurting me is that I keep investing and remembering her, but I do not know if the same care comes back."
    ].join(" ");

    const ctx = createMockContext({ userId: 1001, text });
    await harness.dispatch(ctx);

    expect(ctx.replies).toEqual(["Monica Groq response"]);
    expect(brain.respond).toHaveBeenCalledTimes(1);
  });
});
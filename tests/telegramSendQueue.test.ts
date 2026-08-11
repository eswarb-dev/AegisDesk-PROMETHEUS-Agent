import { describe, expect, it } from "vitest";
import { exportCommand } from "../src/commands/adminLogs.js";
import { TelegramSendQueue, splitTelegramText } from "../src/telegram/sendQueue.js";
import { createMockContext } from "./helpers.js";

function createStorage() {
  return {
    kind: "supabase",
    admin: { writeAuditLog: async () => undefined },
    messages: {
      exportMessages: async () => [
        { direction: "inbound", text_redacted: "hello", created_at: "2026-08-11T10:00:00Z" },
        { direction: "outbound", text_redacted: "hi", created_at: "2026-08-11T10:01:00Z" }
      ]
    }
  };
}

describe("TelegramSendQueue", () => {
  it("enforces per-chat queue spacing", async () => {
    const waits: number[] = [];
    const queue = new TelegramSendQueue({ perChatIntervalMs: 1000, globalIntervalMs: 0, sleep: async (ms) => { waits.push(ms); } });
    const sent: string[] = [];

    await Promise.all([
      queue.enqueue("chat-1", async () => sent.push("a")),
      queue.enqueue("chat-1", async () => sent.push("b"))
    ]);

    expect(sent).toEqual(["a", "b"]);
    expect(waits.some((ms) => ms >= 900)).toBe(true);
  });

  it("enforces global queue spacing", async () => {
    const waits: number[] = [];
    const queue = new TelegramSendQueue({ perChatIntervalMs: 0, globalIntervalMs: 40, sleep: async (ms) => { waits.push(ms); } });

    await Promise.all([
      queue.enqueue("chat-1", async () => "a"),
      queue.enqueue("chat-2", async () => "b")
    ]);

    expect(waits.some((ms) => ms >= 30)).toBe(true);
  });

  it("waits retry_after before retrying Telegram 429", async () => {
    const waits: number[] = [];
    const queue = new TelegramSendQueue({ perChatIntervalMs: 0, globalIntervalMs: 0, sleep: async (ms) => { waits.push(ms); } });
    let attempts = 0;

    const result = await queue.enqueue("chat-1", async () => {
      attempts += 1;
      if (attempts === 1) {
        throw { response: { error_code: 429, parameters: { retry_after: 2 } } };
      }
      return "sent";
    });

    expect(result).toBe("sent");
    expect(waits).toContain(2000);
    expect(attempts).toBe(2);
  });

  it("splits long messages safely", () => {
    const text = `${"a".repeat(3900)}\n\n${"b".repeat(200)}`;

    const chunks = splitTelegramText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 3900)).toBe(true);
  });

  it("export sends one document instead of many messages", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/export aksharaa" }) as ReturnType<typeof createMockContext> & {
      documents: unknown[];
      replyWithDocument: (document: unknown) => Promise<unknown>;
    };
    ctx.documents = [];
    ctx.replyWithDocument = (async (document: unknown) => {
      ctx.documents.push(document);
      return undefined;
    }) as never;

    await exportCommand(ctx, { ownerTelegramId: "1001" }, createStorage() as never);

    expect(ctx.documents).toHaveLength(1);
    expect(ctx.replies).toHaveLength(0);
  });
});

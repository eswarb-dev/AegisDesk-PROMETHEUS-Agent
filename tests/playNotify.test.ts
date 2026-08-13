import { describe, expect, it, vi } from "vitest";
import { notifyCommand } from "../src/commands/notify.js";
import { playCommand } from "../src/commands/play.js";
import { createMockContext } from "./helpers.js";

const config = { ownerTelegramId: "1001" };

describe("play and notify commands", () => {
  it("/play returns grounded playable search links instead of claiming direct playback", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/play alaako loova" });

    await playCommand(ctx);

    expect(ctx.replies[0]).toContain("cannot directly control music playback");
    expect(ctx.replies[0]).toContain("https://music.youtube.com/search");
    expect(ctx.replies[0]).toContain("https://open.spotify.com/search");
  });

  it("/notify broadcasts owner message to unique stored chat IDs", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/notify Service update" });
    const storage = {
      kind: "supabase",
      users: {
        listBroadcastRecipients: vi.fn(async () => [
          { telegram_user_id: "1001", chat_id: "1001", role: "owner" },
          { telegram_user_id: "2002", chat_id: "2002", role: "trusted_contact" },
          { telegram_user_id: "2003", chat_id: "2002", role: "user" },
          { telegram_user_id: "3003", chat_id: null, role: "user" }
        ])
      },
      audit: { writeAuditLog: vi.fn(async () => undefined) }
    };

    await notifyCommand(ctx, config, storage as never);

    expect(ctx.sentMessages).toEqual([
      { chatId: "1001", text: "Service update" },
      { chatId: "2002", text: "Service update" }
    ]);
    expect(ctx.replies[0]).toContain("Sent: 2");
    expect(ctx.replies[0]).toContain("Skipped: 2");
    expect(storage.audit.writeAuditLog).toHaveBeenCalled();
  });

  it("/notify is owner-only", async () => {
    const ctx = createMockContext({ userId: 2002, text: "/notify no" });

    await notifyCommand(ctx, config, { kind: "supabase" } as never);

    expect(ctx.replies[0]).toContain("owner-restricted");
    expect(ctx.sentMessages).toHaveLength(0);
  });
});

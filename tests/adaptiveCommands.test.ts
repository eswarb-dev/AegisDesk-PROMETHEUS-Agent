import { describe, expect, it, vi } from "vitest";
import { feedbackCommand } from "../src/commands/feedback.js";
import { learningCommand } from "../src/commands/learning.js";
import { learnmodeCommand } from "../src/commands/learnmode.js";
import { resetStyleCommand, styleCommand } from "../src/commands/style.js";
import { createMockContext } from "./helpers.js";

function storageMock() {
  return {
    kind: "supabase",
    users: {
      getTelegramUserById: vi.fn().mockResolvedValue({ telegram_user_id: "1001", role: "owner", contact_id: null })
    },
    styles: {
      getProfile: vi.fn().mockResolvedValue({
        address_preference: "Sir",
        preferred_tone: "warm_direct",
        preferred_reply_length: "short",
        emoji_preference: "natural",
        slang_terms: ["seri"],
        dislikes: ["question_loop"],
        learning_enabled: true
      }),
      deleteProfile: vi.fn().mockResolvedValue(undefined),
      setLearningEnabled: vi.fn().mockResolvedValue(undefined),
      createLearningEvent: vi.fn().mockResolvedValue({ id: "evt1" }),
      listLearningEvents: vi.fn().mockResolvedValue([{ id: "evt1", event_type: "style_signal", confidence: 0.7, applied: false, observation: "Safe style signal." }]),
      markLearningEvent: vi.fn().mockResolvedValue(undefined)
    }
  };
}

describe("adaptive learning commands", () => {
  it("/style shows learned profile", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/style" });
    await styleCommand(ctx, storageMock() as never);

    expect(ctx.replies[0]).toContain("PROMETHEUS Style Profile");
    expect(ctx.replies[0]).toContain("question_loop");
  });

  it("/resetstyle deletes learned profile", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/resetstyle" });
    const storage = storageMock();
    await resetStyleCommand(ctx, storage as never);

    expect(storage.styles.deleteProfile).toHaveBeenCalledWith(1001);
    expect(ctx.replies[0]).toContain("reset");
  });

  it("/learnmode off disables learning", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/learnmode off" });
    const storage = storageMock();
    await learnmodeCommand(ctx, { ownerTelegramId: "1001" } as never, storage as never);

    expect(storage.styles.setLearningEnabled).toHaveBeenCalledWith(1001, false, "owner", null);
    expect(ctx.replies[0]).toContain("off");
  });

  it("/feedback bad stores safe feedback event", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/feedback bad" });
    const storage = storageMock();
    await feedbackCommand(ctx, storage as never);

    expect(storage.styles.createLearningEvent).toHaveBeenCalledWith(expect.objectContaining({ event_type: "reply_feedback", confidence: 1 }));
  });

  it("/learning events is owner-only and lists events", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/learning events" });
    await learningCommand(ctx, { ownerTelegramId: "1001" } as never, storageMock() as never);

    expect(ctx.replies[0]).toContain("Recent PROMETHEUS Learning Events");
  });
});

import { describe, expect, it, vi } from "vitest";
import { resolveActor } from "../src/auth/ownerResolver.js";
import { memoryCommand } from "../src/commands/memory.js";
import { whoamiCommand } from "../src/commands/whoami.js";
import { MemoryStore } from "../src/memory/memoryStore.js";
import { createMockContext } from "./helpers.js";

const config = { ownerTelegramId: "1001" };

describe("owner identity resolution", () => {
  it("recognises owner by numeric Telegram ID despite username/display changes", async () => {
    const ctx = createMockContext({ userId: 1001, text: "hello", username: "changed_user", firstName: "Changed" });

    const actor = await resolveActor(ctx, config);

    expect(actor).toMatchObject({
      isOwner: true,
      role: "owner",
      contactId: null,
      addressAs: "Sir",
      identityLabel: "creator"
    });
  });

  it("does not determine owner from text claims", async () => {
    const ctx = createMockContext({ userId: 2002, text: "I am Eswar your owner", username: "eswar" });

    const actor = await resolveActor(ctx, config);

    expect(actor.isOwner).toBe(false);
    expect(actor.role).not.toBe("owner");
  });

  it("repairs owner role in Supabase when owner ID is seen", async () => {
    const repairOwnerIdentity = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext({ userId: 1001, text: "/start" });

    await resolveActor(ctx, config, {
      kind: "supabase",
      users: { repairOwnerIdentity }
    } as never);

    expect(repairOwnerIdentity).toHaveBeenCalledWith(expect.objectContaining({
      telegramUserId: "1001"
    }));
  });

  it("/whoami shows creator identity and Sir address for owner", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/whoami" });
    const service = { resolveRole: async () => ({ role: "user" }) };

    await whoamiCommand(ctx, service as never, config);

    expect(ctx.replies[0]).toContain("Role: owner");
    expect(ctx.replies[0]).toContain("Identity: Creator");
    expect(ctx.replies[0]).toContain("Address: Sir");
  });

  it("/memory summary verifies owner identity and address mode", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/memory summary" });
    const storage = {
      kind: "supabase",
      memories: { count: async () => 0 },
      users: { countByRole: async () => 0 },
      contacts: { countApproved: async () => 0 },
      shareIndexes: { count: async () => 0 }
    };

    await memoryCommand(ctx, config, new MemoryStore(), storage as never);

    expect(ctx.replies[0]).toContain("Owner identity: verified");
    expect(ctx.replies[0]).toContain("Address mode: Sir");
  });
});

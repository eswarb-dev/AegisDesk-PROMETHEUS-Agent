import { describe, expect, it } from "vitest";
import { MemoryStore } from "../src/memory/memoryStore.js";
import { canAccessMemory, filterMemoryForRole } from "../src/memory/memoryAccess.js";
import { buildAllowedMemoryContext } from "../src/memory/trustedMemoryContext.js";

describe("memory visibility access", () => {
  it("enforces role and visibility rules", () => {
    expect(canAccessMemory("owner", "owner_only")).toBe(true);
    expect(canAccessMemory("owner", "trusted_contacts")).toBe(true);
    expect(canAccessMemory("trusted_contact", "trusted_contacts")).toBe(true);
    expect(canAccessMemory("trusted_contact", "public")).toBe(true);
    expect(canAccessMemory("trusted_contact", "owner_only")).toBe(false);
    expect(canAccessMemory("user", "trusted_contacts")).toBe(false);
    expect(canAccessMemory("user", "public")).toBe(true);
  });

  it("filters memories by role before context building", async () => {
    const memory = await new MemoryStore().loadMemory();

    expect(filterMemoryForRole(memory, "owner").some((item) => item.id === "friend_aksharaa")).toBe(true);
    expect(filterMemoryForRole(memory, "trusted_contact").some((item) => item.id === "eswar_current_state")).toBe(true);
    expect(filterMemoryForRole(memory, "trusted_contact").some((item) => item.id === "friend_aksharaa")).toBe(false);
    expect(filterMemoryForRole(memory, "user").every((item) => item.visibility === "public")).toBe(true);
  });

  it("trusted Groq context contains no owner-only memory", async () => {
    const memory = await new MemoryStore().loadMemory();
    const context = buildAllowedMemoryContext(memory, "trusted_contact");

    expect(context).toContain("mentally and physically tired");
    expect(context).not.toContain("Aksharaa is one of his close friends");
    expect(context).not.toContain("friend_aksharaa");
  });
});

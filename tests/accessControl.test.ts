import { describe, expect, it } from "vitest";
import { isPrivateEswarQuestion, resolveAccessProfile } from "../src/security/accessControl.js";

const config = { ownerTelegramId: "1001" };

describe("access control", () => {
  it("resolves owner privileges separately from guests", () => {
    expect(resolveAccessProfile(1001, { ownerTelegramId: "1001" })).toMatchObject({
      role: "owner",
      canUsePrivateMemory: true,
      canUseMemoryCommands: true
    });

    expect(resolveAccessProfile(2002, config)).toMatchObject({
      role: "user",
      canUsePrivateMemory: false,
      canUseMemoryCommands: false
    });
  });

  it("identifies private Eswar memory questions", () => {
    expect(isPrivateEswarQuestion("What do you know about Eswar's projects?")).toBe(true);
    expect(isPrivateEswarQuestion("Hello Prometheus")).toBe(false);
  });
});

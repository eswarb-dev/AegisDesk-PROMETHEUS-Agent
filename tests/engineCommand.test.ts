import { describe, expect, it, vi } from "vitest";
import { engineCommand } from "../src/commands/engine.js";
import { config } from "../src/config.js";

describe("/engine command", () => {
  it("returns owner runtime status", async () => {
    const reply = vi.fn();
    await engineCommand(
      {
        from: { id: 123 },
        reply
      } as never,
      { ...config, ownerTelegramId: "123" }
    );

    expect(reply).toHaveBeenCalledWith(expect.stringContaining("PROMETHEUS Engine Status"));
    expect(reply).toHaveBeenCalledWith(expect.stringContaining("Groq:"));
    expect(reply).toHaveBeenCalledWith(expect.stringContaining("Fallback:"));
  });

  it("restricts non-owner engine status", async () => {
    const reply = vi.fn();
    await engineCommand(
      {
        from: { id: 456 },
        reply
      } as never,
      { ...config, ownerTelegramId: "123" }
    );

    expect(reply).toHaveBeenCalledWith(expect.stringContaining("owner-restricted"));
  });
});

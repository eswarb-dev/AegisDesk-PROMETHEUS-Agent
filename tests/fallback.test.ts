import { describe, expect, it } from "vitest";
import { fallbackResponder } from "../src/prometheus/fallbackResponder.js";

describe("fallback responses", () => {
  it("loads fallback JSON", async () => {
    const responses = await fallbackResponder.load();

    expect(responses.owner_api_error?.length).toBeGreaterThan(0);
    expect(responses.owner_unknown?.[0]).toContain("Sir");
    expect(responses.non_owner?.[0]).toContain("owner-restricted");
  });

  it("dedupes repeated owner fallback for five minutes", async () => {
    const first = await fallbackResponder.pick("owner_api_error", { chatId: "owner-test", now: 1000 });
    const second = await fallbackResponder.pick("owner_api_error", { chatId: "owner-test", now: 2000 });

    expect(first).toContain("Sir");
    expect(second).toBe("Still in basic mode, Sir. I’m here, but deeper replies are paused.");
  });

  it("uses warmer deterministic emotional fallback", async () => {
    await expect(fallbackResponder.pick("owner_api_error", { userText: "prometheus dont leave me" })).resolves.toBe(
      "I’m here, Sir. Even in basic mode, I won’t disappear."
    );
    await expect(fallbackResponder.pick("owner_api_error", { userText: "at least you're here" })).resolves.toBe("Always here, Sir. Basic mode or not.");
  });

  it("owner fallback does not claim Groq is online", async () => {
    const responses = await fallbackResponder.load();

    expect(responses.owner_api_error?.join("\n").toLowerCase()).not.toContain("groq is online");
  });
});

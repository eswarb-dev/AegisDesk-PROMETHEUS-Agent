import { describe, expect, it } from "vitest";
import { fallbackResponder } from "../src/prometheus/fallbackResponder.js";

describe("fallback responses", () => {
  it("loads fallback JSON", async () => {
    const responses = await fallbackResponder.load();

    expect(responses.owner_api_error?.length).toBeGreaterThan(0);
    expect(responses.owner_unknown?.[0]).toContain("Sir");
    expect(responses.non_owner?.[0]).toContain("owner-restricted");
  });
});

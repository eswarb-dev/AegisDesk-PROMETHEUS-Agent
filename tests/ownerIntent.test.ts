import { describe, expect, it } from "vitest";
import { validateOwnerResponse } from "../src/prometheus/ownerIntent.js";

describe("owner response validation", () => {
  it("rejects questions after simple acknowledgements", () => {
    expect(validateOwnerResponse("You're welcome, Sir. Your day is good, I assume?", "casual_chat", "thank you")).toBe(false);
    expect(validateOwnerResponse("Good, Sir. How was your morning?", "casual_chat", "yes sir")).toBe(false);
  });

  it("rejects mismatched local time greetings", () => {
    expect(validateOwnerResponse("Good morning, Sir.", "casual_chat", "yes sir", "UTC")).toBe(false);
  });
});

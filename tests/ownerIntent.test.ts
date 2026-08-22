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

  it("rejects generic follow-up questions for casual owner chat", () => {
    expect(validateOwnerResponse("All good, Sir 😊 Anything else you'd like to chat about?", "casual_chat", "how's going")).toBe(false);
    expect(validateOwnerResponse("Sounds festive, Sir 🎉 Did they have a traditional feast?", "casual_chat", "today in my college we celebrated onam festival")).toBe(false);
  });

  it("allows direct answers without question loops", () => {
    expect(validateOwnerResponse("Sounds good, Sir 🎉 That kind of college festival moment gives the day a lighter feel.", "casual_chat", "today in my college we celebrated onam festival")).toBe(true);
  });
});

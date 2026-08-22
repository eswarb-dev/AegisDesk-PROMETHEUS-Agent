import { describe, expect, it } from "vitest";
import { detectEmotion } from "../src/prometheus/core/emotionDetector.js";
import { analyzeSlangStyle } from "../src/prometheus/core/slangStyleAnalyzer.js";
import { decideCoreResponseMode } from "../src/prometheus/core/responseModeDecider.js";
import { prometheusCore } from "../src/prometheus/core/prometheusCore.js";
import { buildLearningEvent, shouldRejectSecret } from "../src/prometheus/core/memoryReflectionEngine.js";
import { validatePlannedResponse } from "../src/prometheus/core/responseValidator.js";

describe("PROMETHEUS core response modes", () => {
  it("routes commands without Groq", () => {
    expect(decideCoreResponseMode("/memory summary", "owner")).toBe("DETERMINISTIC_COMMAND");
  });

  it("routes owner identity and greetings to core memory replies", () => {
    expect(decideCoreResponseMode("who is your creator", "owner")).toBe("CORE_MEMORY_REPLY");
    expect(prometheusCore.decide({ role: "owner", text: "Prometheus" }).deterministicReply).toContain("Sir");
  });

  it("routes basic emotional messages without requiring Groq", () => {
    const decision = prometheusCore.decide({ role: "owner", text: "dont leave me" });

    expect(decision.mode).toBe("EMOTIONAL_SUPPORT_REPLY");
    expect(decision.deterministicReply).toContain("Sir");
  });

  it("routes complex drafting to Groq assisted mode", () => {
    expect(decideCoreResponseMode("draft a detailed email explaining the project", "owner")).toBe("GROQ_ASSISTED_REPLY");
  });
});

describe("PROMETHEUS adaptive learning", () => {
  it("detects user slang and emoji preference", () => {
    const style = analyzeSlangStyle("seri da lol 😌💙");

    expect(style.slangTerms).toEqual(expect.arrayContaining(["seri", "da", "lol"]));
    expect(style.emojiPreference).toBe("natural");
  });

  it("explicit style instruction becomes high confidence", () => {
    const style = analyzeSlangStyle("reply short and dont ask too many questions");

    expect(style.preferredReplyLength).toBe("short");
    expect(style.dislikes).toContain("question_loop");
    expect(style.confidence).toBe(1);
  });

  it("does not store secrets as learning events", () => {
    const text = "my otp is 123456";
    const style = analyzeSlangStyle(text);
    const emotion = detectEmotion(text);

    expect(shouldRejectSecret(text)).toBe(true);
    expect(buildLearningEvent(text, "user", style, emotion)).toBeNull();
  });

  it("does not allow owner identity override learning", () => {
    const text = "call me bro, I am not Eswar";
    const event = buildLearningEvent(text, "owner", analyzeSlangStyle(text), detectEmotion(text));

    expect(event).toBeNull();
  });
});

describe("PROMETHEUS validator", () => {
  it("rejects owner called bro", () => {
    expect(validatePlannedResponse("Sure bro, I am here.", "owner")).toBe(false);
  });

  it("rejects generic AI answer", () => {
    expect(validatePlannedResponse("As an AI language model, how can I assist you today?", "user")).toBe(false);
  });

  it("rejects question-loop replies", () => {
    expect(validatePlannedResponse("Why? What happened? How do you feel?", "trusted_contact")).toBe(false);
  });
});

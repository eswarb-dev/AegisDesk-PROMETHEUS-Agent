import type { UserRole } from "../../memory/memoryTypes.js";
import type { StyleSignal } from "./slangStyleAnalyzer.js";
import type { EmotionSignal } from "./emotionDetector.js";

export type LearningEventDraft = {
  eventType: "style_signal" | "explicit_style_instruction" | "emotional_pattern";
  observation: string;
  memoryUpdate: Record<string, unknown>;
  confidence: number;
};

export function shouldRejectSecret(text: string): boolean {
  return /\b(password|otp|api key|secret|private key|token|card number|cvv|recovery code|oauth|cookie)\b/i.test(text);
}

export function buildLearningEvent(text: string, role: UserRole | "owner", style: StyleSignal, emotion: EmotionSignal): LearningEventDraft | null {
  if (role === "owner" && /\b(call me|address me|i am not eswar|owner is)\b/i.test(text)) return null;
  if (shouldRejectSecret(text)) return null;
  if (style.confidence >= 1) {
    return {
      eventType: "explicit_style_instruction",
      observation: "User gave an explicit reply style preference.",
      memoryUpdate: compactUpdate(style),
      confidence: 1
    };
  }
  if (style.slangTerms.length || style.preferredTone || style.emojiPreference === "expressive") {
    return {
      eventType: "style_signal",
      observation: "User message contained safe style/slang signals.",
      memoryUpdate: compactUpdate(style),
      confidence: style.confidence
    };
  }
  if (emotion.needsSupport && emotion.severity !== "low") {
    return {
      eventType: "emotional_pattern",
      observation: `User showed ${emotion.state} emotional tone.`,
      memoryUpdate: { emotional_support_style: "validate_first_then_practical", repeated_topics: [emotion.state] },
      confidence: 0.3
    };
  }
  return null;
}

function compactUpdate(style: StyleSignal): Record<string, unknown> {
  return {
    slang_terms: style.slangTerms,
    emoji_preference: style.emojiPreference,
    preferred_reply_length: style.preferredReplyLength,
    preferred_tone: style.preferredTone,
    dislikes: style.dislikes
  };
}

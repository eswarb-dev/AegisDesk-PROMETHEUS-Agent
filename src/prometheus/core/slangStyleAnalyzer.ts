export type StyleSignal = {
  slangTerms: string[];
  emojiPreference: "minimal" | "natural" | "expressive";
  preferredReplyLength?: "short" | "medium" | "detailed";
  preferredTone?: "warm_direct" | "casual_warm" | "gentle" | "direct";
  dislikes: string[];
  confidence: number;
};

const SLANG_TERMS = ["bro", "da", "dei", "macha", "seri", "okie", "lol", "illa", "enna", "tired mind", "mood off"];

export function analyzeSlangStyle(text: string): StyleSignal {
  const normalized = text.toLowerCase();
  const slangTerms = SLANG_TERMS.filter((term) => normalized.includes(term));
  const emojiCount = Array.from(text.matchAll(/\p{Extended_Pictographic}/gu)).length;
  const dislikes: string[] = [];
  let preferredReplyLength: StyleSignal["preferredReplyLength"];
  let preferredTone: StyleSignal["preferredTone"];
  let confidence = slangTerms.length ? 0.3 : 0.1;

  if (/\b(reply short|short reply|keep it short|be short)\b/.test(normalized)) {
    preferredReplyLength = "short";
    confidence = 1;
  } else if (/\b(explain detail|detailed|long answer)\b/.test(normalized)) {
    preferredReplyLength = "detailed";
    confidence = 1;
  }
  if (/\b(don't ask too many questions|dont ask too many questions|no question loop|answer first)\b/.test(normalized)) {
    dislikes.push("question_loop");
    preferredTone = "warm_direct";
    confidence = 1;
  }
  if (/\b(don't call me bro|dont call me bro)\b/.test(normalized)) {
    dislikes.push("being called bro");
    confidence = 1;
  }
  if (slangTerms.length >= 2 || /\b(casual|natural)\b/.test(normalized)) preferredTone = "casual_warm";

  return {
    slangTerms,
    emojiPreference: emojiCount >= 3 ? "expressive" : emojiCount > 0 ? "natural" : "minimal",
    preferredReplyLength,
    preferredTone,
    dislikes,
    confidence
  };
}

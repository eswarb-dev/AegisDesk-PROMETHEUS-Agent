export type EmotionalState = "neutral" | "happy" | "tired" | "stressed" | "sad" | "lonely" | "anxious" | "angry" | "overwhelmed" | "emotionally_distressed" | "crisis_risk";
export type EmotionalSeverity = "low" | "medium" | "high" | "critical";

export type EmotionSignal = {
  state: EmotionalState;
  severity: EmotionalSeverity;
  needsSupport: boolean;
};

export function detectEmotion(text: string): EmotionSignal {
  const normalized = text.toLowerCase();
  if (/\b(suicide|kill myself|end my life|self harm|can't live|cant live)\b/.test(normalized)) {
    return { state: "crisis_risk", severity: "critical", needsSupport: true };
  }
  if (/\b(worthless|nobody cares|don't want to live|dont want to live|can't handle|cant handle|broken|don't leave|dont leave)\b/.test(normalized)) {
    return { state: "emotionally_distressed", severity: "high", needsSupport: true };
  }
  if (/\b(overwhelmed|too much|panic|panicking)\b/.test(normalized)) return { state: "overwhelmed", severity: "medium", needsSupport: true };
  if (/\b(anxious|anxiety|scared|afraid|fear)\b/.test(normalized)) return { state: "anxious", severity: "medium", needsSupport: true };
  if (/\b(alone|lonely|left out|no one)\b/.test(normalized)) return { state: "lonely", severity: "medium", needsSupport: true };
  if (/\b(sad|cry|crying|low|mood off|not okay|not ok)\b/.test(normalized)) return { state: "sad", severity: "medium", needsSupport: true };
  if (/\b(tired|tired mind|drained|exhausted)\b/.test(normalized)) return { state: "tired", severity: "low", needsSupport: true };
  if (/\b(happy|good|great|nice|excited|thank)\b/.test(normalized)) return { state: "happy", severity: "low", needsSupport: false };
  if (/\b(angry|mad|irritated|pissed)\b/.test(normalized)) return { state: "angry", severity: "medium", needsSupport: true };
  if (/\b(stress|stressed|pressure)\b/.test(normalized)) return { state: "stressed", severity: "medium", needsSupport: true };
  return { state: "neutral", severity: "low", needsSupport: false };
}

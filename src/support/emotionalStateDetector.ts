export type EmotionalState =
  | "neutral"
  | "happy"
  | "confused"
  | "stressed"
  | "sad"
  | "lonely"
  | "anxious"
  | "angry"
  | "overwhelmed"
  | "emotionally_distressed"
  | "crisis_risk";

export type DistressSeverity = "low" | "medium" | "high" | "critical";

export type EmotionalSignal = {
  state: EmotionalState;
  severity: DistressSeverity;
  shouldConsiderAlert: boolean;
  safeQuote: string;
};

export class EmotionalStateDetector {
  classify(text: string): EmotionalSignal {
    const clean = text.replace(/\s+/g, " ").trim();
    const lower = clean.toLowerCase();

    if (/\b(kill myself|suicide|end my life|hurt myself|harm myself|die right now|not safe with myself|hurt someone)\b/.test(lower)) {
      return signal("crisis_risk", "critical", clean);
    }
    if (/\b(i can'?t handle this|i feel broken|want to disappear|panic|can'?t breathe|so alone|nobody cares)\b/.test(lower)) {
      return signal("emotionally_distressed", "high", clean);
    }
    if (/\b(i feel bad|i'?m tired of this|no one understands|i don'?t know what to do|feel lost|too much)\b/.test(lower)) {
      return signal("emotionally_distressed", "medium", clean);
    }
    if (/\b(i'?m fine|leave it|nothing|it'?s okay|don'?t want to bother anyone|do not want to bother anyone)\b/.test(lower)) {
      return signal("sad", "low", clean, false);
    }
    if (/\b(sad|lonely|alone|stressed|anxious|angry|overwhelmed|confused|tired|nobody notices me|no one understands|don'?t know whom to talk to|feel bad)\b/.test(lower)) {
      if (/\blonely|alone\b/.test(lower)) return signal("lonely", "low", clean, false);
      if (/\banxious|panic\b/.test(lower)) return signal("anxious", "low", clean, false);
      if (/\boverwhelmed|too much\b/.test(lower)) return signal("overwhelmed", "low", clean, false);
      if (/\bangry|mad\b/.test(lower)) return signal("angry", "low", clean, false);
      if (/\bconfused|don'?t understand\b/.test(lower)) return signal("confused", "low", clean, false);
      return signal("sad", "low", clean, false);
    }
    if (/\b(happy|good|great|nice|excited|better)\b/.test(lower)) return signal("happy", "low", clean, false);
    return signal("neutral", "low", clean, false);
  }
}

function signal(state: EmotionalState, severity: DistressSeverity, text: string, alert = true): EmotionalSignal {
  return {
    state,
    severity,
    shouldConsiderAlert: alert,
    safeQuote: text.slice(0, 220)
  };
}

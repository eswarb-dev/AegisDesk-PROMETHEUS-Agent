export type PrometheusIntent =
  | "command"
  | "greeting"
  | "identity"
  | "owner_memory"
  | "emotional_support"
  | "trusted_eswar_question"
  | "drafting"
  | "complex_reasoning"
  | "unknown";

export function detectIntent(text: string): PrometheusIntent {
  const normalized = normalize(text);
  if (normalized.startsWith("/")) return "command";
  if (/^(hi|hii|hello|hey|yo|prometheus|are you here|you there)\b/.test(normalized)) return "greeting";
  if (/\b(who are you|who created you|who is your creator|your creator|owner|are you prometheus)\b/.test(normalized)) return "identity";
  if (/\b(what do you know about me|owner memory|memory summary|tell me about myself|describe me)\b/.test(normalized)) return "owner_memory";
  if (/\b(i feel|not okay|not ok|alone|lonely|tired|tired mind|sad|mood off|overwhelmed|stress|anxious|don't leave|dont leave|depressed|crying|worthless|end it|suicide|kill myself)\b/.test(normalized)) return "emotional_support";
  if (/\beswar\b/.test(normalized) && /\b(tell|about|who|what|care|listen|working|creator)\b/.test(normalized)) return "trusted_eswar_question";
  if (/\b(draft|rewrite|write|email|caption|message|summarize|explain)\b/.test(normalized)) return "drafting";
  if (normalized.length > 90 || /\b(why|how|plan|reason|compare|decide|strategy)\b/.test(normalized)) return "complex_reasoning";
  return "unknown";
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();
}

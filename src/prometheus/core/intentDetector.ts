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
  if (/^(hi|hii|hello|hey|yo|prometheus|are you here|you there|how'?s going|how is going|how are you|how are things)\b/.test(normalized)) return "greeting";
  if (/^(of course|sure|sure thing|just a casual one|casual one|both)\b/.test(normalized)) return "greeting";
  if (isDominantShortFestivalMessage(normalized)) return "greeting";
  if (/\b(who are you|who created you|who is your creator|your creator|owner|are you prometheus)\b/.test(normalized)) return "identity";
  if (/\b(what do you know about me|owner memory|memory summary|tell me about myself|describe me)\b/.test(normalized)) return "owner_memory";
  if (/\b(i feel|not okay|not ok|alone|lonely|tired|tired mind|sad|mood off|overwhelmed|stress|anxious|don't leave|dont leave|depressed|crying|worthless|end it|suicide|kill myself)\b/.test(normalized)) return "emotional_support";
  if (/\beswar\b/.test(normalized) && /\b(tell|about|who|what|care|listen|working|creator)\b/.test(normalized)) return "trusted_eswar_question";
  if (/\b(draft|rewrite|write|email|caption|message|summarize|explain)\b/.test(normalized)) return "drafting";
  if (normalized.length > 90 || /\b(why|how|plan|reason|compare|decide|strategy)\b/.test(normalized)) return "complex_reasoning";
  return "unknown";
}

function isDominantShortFestivalMessage(normalized: string): boolean {
  if (!/\b(celebrated|celebration|festival|onam)\b/.test(normalized)) return false;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 18) return false;
  const emotionalRelationshipTerms = /\b(friend|friendship|monica|durga|left behind|reciprocity|support|checks on|checking on|always|hurt|pain|investment|invested|best friend|ignored|alone)\b/;
  if (emotionalRelationshipTerms.test(normalized)) return false;
  return /\b(college|campus|day|today|went|celebrated|celebration|festival|onam|fun|enjoy|enjoyed|nice|good)\b/.test(normalized);
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();
}

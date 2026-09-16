export type ResponseMode =
  | "DETERMINISTIC_COMMAND"
  | "FACT_RETRIEVAL_THEN_NATURAL_REPLY"
  | "GROQ_CHAT"
  | "OWNER_MEMORY_SUMMARY"
  | "CONTEXTUAL_REPLY_TO_OWNER_RELAY"
  | "CODING_PROBLEM_SOLVER"
  | "TRUSTED_CONTACT_SUPPORT"
  | "UNSUPPORTED";

export type ResponseDecision = {
  mode: ResponseMode;
  contactId?: "aksharaa" | "vathanya" | "maddhurika";
  asksAboutOwner?: boolean;
};

const CONTACTS = ["aksharaa", "vathanya", "maddhurika"] as const;

export function decideResponseMode(text: string): ResponseDecision {
  const normalized = text.toLowerCase().replace(/[?!.,]/g, "").trim();
  if (!normalized) return { mode: "UNSUPPORTED" };

  if (/^\/(?:code|solve|leetcode)\b/i.test(text.trim())) {
    return { mode: "CODING_PROBLEM_SOLVER" };
  }

  if (normalized.startsWith("/")) {
    return { mode: "DETERMINISTIC_COMMAND" };
  }

  if (isCodingRequest(text)) {
    return { mode: "CODING_PROBLEM_SOLVER" };
  }

  if (isLongPersonalStory(normalized)) return { mode: "GROQ_CHAT" };

  const contactId = CONTACTS.find((contact) => normalized.includes(contact));
  if (isContactLogQuestion(normalized)) {
    return {
      mode: "FACT_RETRIEVAL_THEN_NATURAL_REPLY",
      contactId,
      asksAboutOwner: /\b(me|about me|eswar|owner)\b/.test(normalized)
    };
  }

  if (isOwnerMemoryQuestion(normalized)) {
    return { mode: "OWNER_MEMORY_SUMMARY" };
  }

  if (/\b(i feel|feel low|not okay|panic|depressed|mental health|alert eswar|tell eswar)\b/.test(normalized)) {
    return { mode: "TRUSTED_CONTACT_SUPPORT" };
  }

  return { mode: "GROQ_CHAT" };
}

export function decideTrustedContactResponseMode(input: {
  text: string;
  recentContext?: Array<{ direction?: string; owner_initiated?: boolean; sender_role?: string | null; sender_label?: string | null; message_type?: string; text?: string | null; text_redacted?: string | null; contact_id?: string | null }>;
}): ResponseDecision {
  const recentOwnerRelay = input.recentContext?.slice().reverse().find((message) => message.direction === "outbound" && isOwnerRelayMessage(message));
  if (recentOwnerRelay && isShortReaction(input.text) && !isClearDistressText(input.text)) {
    return { mode: "CONTEXTUAL_REPLY_TO_OWNER_RELAY" };
  }
  return decideResponseMode(input.text);
}

function isLongPersonalStory(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 45) return false;
  return /\b(friend|friendship|monica|durga|left behind|reciprocity|support|checking on|private instagram|male best friend|bond|hurt|investing|remembering)\b/.test(text);
}

function isContactLogQuestion(text: string): boolean {
  const namesContact = /\b(aksharaa|vathanya|maddhurika|anyone|they|trusted contact)\b/.test(text);
  const asksForRetrieval = /\b(what|who|when|where|whether|did|does|do|show|check|tell me|summarize|summary|list)\b/.test(text);
  const mentionsLogAction = /\b(logs?|conversation|chatted|chat|talk|talked|asked|messaged|message)\b/.test(text);

  if (namesContact && asksForRetrieval && mentionsLogAction) {
    return true;
  }
  return /\b(who|what|did anyone|what did they)\b.*\b(ask|asked|say|said|message|messaged|talk|talked|chat|chatted)\b.*\b(me|about me|eswar)\b/.test(text);
}

function isOwnerMemoryQuestion(text: string): boolean {
  return /\b(what do you know about me|list .*know about me|tell me about myself|tell me about me|describe me|what is stored in owner memory|owner memory summary)\b/.test(text);
}

function isCodingRequest(text: string): boolean {
  const normalized = text.toLowerCase();
  if (/\b(explain|what is|how does)\b.*\b(sliding window|binary search|dfs|bfs|dynamic programming|recursion)\b/.test(normalized) && !/\b(code|solve|program|solution|leetcode|constraints?|test cases?)\b/.test(normalized)) {
    return false;
  }
  if (/\b(solve this|give code|write (?:a )?(?:solution|program|code)|leetcode|test cases|constraints|python code|java code|cpp code|c\+\+ code|javascript code|typescript code|c# code)\b/.test(normalized)) return true;
  if (/\bexample\s*\d*\s*:/.test(normalized) && /\bconstraints?\s*:/.test(normalized)) return true;
  if (/^given\b/i.test(text) && /\b(return|find|calculate|determine)\b/i.test(text) && /\b(input|output|example|constraints?)\b/i.test(text)) return true;
  return false;
}

function isOwnerRelayMessage(message: { owner_initiated?: boolean; sender_role?: string | null; sender_label?: string | null; message_type?: string; text?: string | null; text_redacted?: string | null }): boolean {
  if (message.owner_initiated || message.sender_role === "owner" || message.sender_label === "owner_via_prometheus" || message.message_type === "owner_relay") return true;
  return /\b(owner_via_prometheus|birthday|bday|😂|caught|plan)\b/i.test(message.text_redacted ?? message.text ?? "");
}

function isShortReaction(text: string): boolean {
  const clean = text.trim().toLowerCase();
  if (!clean) return false;
  if (/^(😭+|😂+|🤣+|🥲+|😅+|😢+|😌+|👍+|❤️+|💀+|ok+|okay|okie|seri|hmm+|oh+h+|ayyoo+|by mistake+|by mistake\.*|mistake\.*)$/iu.test(clean)) return true;
  return clean.length <= 24 && /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s.!?]+$/u.test(clean);
}

function isClearDistressText(text: string): boolean {
  return /\b(i'?m not okay|i am not okay|not ok|feel alone|i feel alone|want to cry|can'?t handle|cant handle|mental health|depressed|depression|worthless|panic)\b/i.test(text);
}

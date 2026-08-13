export type ResponseMode =
  | "DETERMINISTIC_COMMAND"
  | "FACT_RETRIEVAL_THEN_NATURAL_REPLY"
  | "GROQ_CHAT"
  | "OWNER_MEMORY_SUMMARY"
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

  if (normalized.startsWith("/")) {
    return { mode: "DETERMINISTIC_COMMAND" };
  }

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

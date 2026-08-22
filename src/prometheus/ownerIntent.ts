import type { ContactId, TrustedContact } from "../contacts/trustedContactTypes.js";
import type { StorageProvider } from "../storage/storageProvider.js";

export type OwnerIntent =
  | "greeting"
  | "emotional_state"
  | "capability_check"
  | "command_request"
  | "memory_question"
  | "trusted_contact_query"
  | "support_request"
  | "casual_chat"
  | "unknown";

const CONTACTS: ContactId[] = ["aksharaa", "vathanya", "maddhurika"];

export function classifyOwnerIntent(text: string): OwnerIntent {
  const normalized = normalize(text);
  if (/^(hi|hii|hello|hey|yo|sup|good morning|gud mrng|gm|morning|gud morning)\b/.test(normalized)) return "greeting";
  if (/\b(can you|could you|check whether|are you able|do you have|can u)\b/.test(normalized) && /\b(send|text|message|tell|dm|trusted contact|contact)\b/.test(normalized)) return "capability_check";
  if (/\b(command|syntax|how do i use|what command|available command)\b/.test(normalized)) return "command_request";
  if (/\b(remember|memory|know about me|stored|summary)\b/.test(normalized)) return "memory_question";
  if (CONTACTS.some((contact) => normalized.includes(contact)) || /\btrusted contact|contacts?\b/.test(normalized)) return "trusted_contact_query";
  if (/\b(tired|sad|low|lonely|overwhelmed|stressed|anxious|bad mind|tired mind|nothing but)\b/.test(normalized)) return "emotional_state";
  if (/\b(support|help me|guide me|mentor)\b/.test(normalized)) return "support_request";
  if (normalized.length > 0) return "casual_chat";
  return "unknown";
}

export async function buildCapabilityResponse(text: string, storage?: StorageProvider): Promise<string | null> {
  const contactId = extractContactId(text);
  const contacts = await loadContactStates(storage);
  if (contactId) {
    const contact = contacts.find((item) => item.id === contactId);
    if (contact?.linked) {
      return [
        `Yes, Sir. I can send a message to ${contact.name} through \`/tell\`.`,
        "",
        "Use:",
        `\`/tell ${contact.id} <message>\``,
        "",
        "Trusted memory access: enabled",
        "Owner-only memory: protected"
      ].join("\n");
    }
    return [
      `Not yet, Sir. ${titleCase(contactId)} is trusted in the slot, but their Telegram ID is not linked.`,
      "Ask them to send /start to PROMETHEUS first, then approve them with /trust."
    ].join("\n");
  }

  return [
    "Yes, Sir. I can send owner-approved messages to linked trusted contacts.",
    "",
    "Currently:",
    ...contacts.map((contact) => `${contact.name}: ${contact.linked ? "linked ✅" : "not linked"}`),
    "",
    "Use:",
    "`/tell aksharaa <message>`"
  ].join("\n");
}

export function validateOwnerResponse(response: string, intent: OwnerIntent, userText = "", timezone = "Asia/Kolkata"): boolean {
  const trimmed = response.trim();
  if (!trimmed) return false;
  if (/\b(how can i help|what can i help|what'?s on your mind|how can i assist)\b/i.test(trimmed)) return false;
  if (/\b(you'?re not a trusted contact|you are on eswar'?s contact list|my owner eswar|someone else|cannot access owner memory|can't access owner memory|bro|buddy|my guy|dear user)\b/i.test(trimmed)) return false;
  if (hasWrongTimeGreeting(trimmed, timezone)) return false;
  if (intent === "capability_check" && !/\/tell|linked|not linked|can send/i.test(trimmed)) return false;
  const questions = trimmed.match(/\?/g)?.length ?? 0;
  if (questions > 1) return false;
  if (["capability_check", "command_request", "memory_question", "trusted_contact_query"].includes(intent) && trimmed.endsWith("?")) return false;
  if (isAcknowledgementOrConfirmation(userText) && questions > 0) return false;
  if (hasUnneededQuestion(trimmed, userText, intent)) return false;
  return true;
}

export function deterministicOwnerFallback(text: string, intent: OwnerIntent): string {
  if (intent === "emotional_state") {
    return [
      "Understood, Sir.",
      "Don’t force heavy thinking right now.",
      "",
      "Do the refresh first — water, face wash, small reset.",
      "Then come back as the problem solver. I’ll keep the emotional supporter role beside it 😌"
    ].join("\n");
  }
  if (intent === "capability_check") {
    return "Yes, Sir. I can check trusted-contact messaging from backend state. Use `/contacts` to see linked contacts and `/tell <contact_id> <message>` to send.";
  }
  if (/problem solver|emotional supporter/i.test(text)) {
    return "Locked in, Sir. Problem solver first, emotional supporter beside it. I’ll answer directly instead of circling you with questions.";
  }
  return "Got it, Sir. I’ll answer directly with what I know, what I don’t, and the next command when there is one.";
}

function extractContactId(text: string): ContactId | null {
  const normalized = normalize(text);
  return CONTACTS.find((contact) => normalized.includes(contact)) ?? null;
}

async function loadContactStates(storage?: StorageProvider): Promise<Array<{ id: ContactId; name: string; linked: boolean }>> {
  if (storage?.kind === "supabase") {
    const data = await storage.contacts.list();
    return CONTACTS.map((id) => {
      const contact = data.trusted_contacts.find((item) => item.id === id);
      return { id, name: contact?.name ?? titleCase(id), linked: Boolean(contact?.telegram_user_id && contact.enabled) };
    });
  }
  return CONTACTS.map((id) => ({ id, name: titleCase(id), linked: false }));
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[?!.,]/g, "").trim();
}

function isAcknowledgementOrConfirmation(text: string): boolean {
  const normalized = normalize(text);
  return /^(thanks|thank you|thankyou|ty|yes|yes sir|ok|okay|okay sir|done|cool|nice|great|good|of course|sure|sure thing|both|just a casual one|casual one)$/.test(normalized);
}

function hasUnneededQuestion(response: string, userText: string, intent: OwnerIntent): boolean {
  if (!response.includes("?")) return false;
  const normalizedResponse = response.toLowerCase();
  if (/\b(anything else|anything in particular|what sparks your interest|what would you like|what'?s on your mind|how can i help|how can i assist)\b/.test(normalizedResponse)) return true;
  if (intent === "emotional_state" || intent === "support_request") return false;
  const normalizedUser = normalize(userText);
  const userAskedQuestion = /\?$/.test(userText.trim()) || /^(why|what|how|when|where|who|which|can|could|should|would|will|do|does|did|is|are)\b/.test(normalizedUser);
  if (!userAskedQuestion && /\?$/.test(response.trim())) return true;
  if (!userAskedQuestion && /\b(did they|was it|were there|do you want|want me to)\b/.test(normalizedResponse)) return true;
  return false;
}

function hasWrongTimeGreeting(response: string, timezone: string): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false
  }).format(new Date()));
  const normalized = response.toLowerCase();
  if (/\bgood morning\b/.test(normalized) && (hour < 4 || hour >= 12)) return true;
  if (/\bgood afternoon\b/.test(normalized) && (hour < 12 || hour >= 17)) return true;
  if (/\bgood evening\b/.test(normalized) && (hour < 17 || hour >= 22)) return true;
  if (/\bgood night\b/.test(normalized) && (hour >= 5 && hour < 21)) return true;
  return false;
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

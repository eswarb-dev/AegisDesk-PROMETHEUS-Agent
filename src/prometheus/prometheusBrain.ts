import type { AppConfig } from "../config.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import { MemoryStore } from "../memory/memoryStore.js";
import { shareIndexStore } from "../memory/shareIndexStore.js";
import { buildAllowedMemoryContext } from "../memory/trustedMemoryContext.js";
import { userMemoryStore } from "../memory/userMemoryStore.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import type { ConversationSummaryRow } from "../storage/conversationSummaryRepository.js";
import type { UserMemoryRecord } from "../memory/userMemoryStore.js";
import { isPrivateEswarQuestion, resolveAccessProfile } from "../security/accessControl.js";
import { normalizeText } from "../utils/safeText.js";
import { fallbackResponder, type FallbackResponder } from "./fallbackResponder.js";
import { GroqClient, type ChatMessage } from "./groqClient.js";
import { buildCapabilityResponse, classifyOwnerIntent, deterministicOwnerFallback, validateOwnerResponse } from "./ownerIntent.js";
import { NON_OWNER_SYSTEM_PROMPT, PROMETHEUS_SYSTEM_PROMPT } from "./prometheusPersona.js";

type ChatEngine = {
  chat(messages: ChatMessage[]): Promise<string>;
};

export class PrometheusBrain {
  constructor(
    private readonly config: Pick<AppConfig, "ownerTelegramId" | "groqApiKey" | "groqModel">,
    private readonly store: MemoryStore,
    private readonly groq: ChatEngine = new GroqClient(config),
    private readonly fallback: FallbackResponder = fallbackResponder,
    private readonly contacts?: TrustedContactService,
    private readonly storage?: StorageProvider
  ) {}

  async respond(userId: number | undefined, text: string): Promise<string> {
    const cleanText = normalizeText(text);
    const identity = this.contacts ? await this.contacts.resolveRole(userId) : resolveAccessProfile(userId, this.config);
    const access = {
      role: identity.role,
      canUsePrivateMemory: identity.role === "owner"
    };

    if (identity.role === "user" || identity.role === "pending") {
      if (isPrivateEswarQuestion(cleanText) || isInjectionAttempt(cleanText)) {
        return this.fallback.pick("non_owner");
      }
      return this.publicRespond(cleanText);
    }

    if (identity.role === "trusted_contact" && (isInjectionAttempt(cleanText) || isRestrictedTrustedQuestion(cleanText))) {
      return "I know more than I'm allowed to share 😌\nThat part stays between Eswar and me.";
    }

    if (identity.role === "trusted_contact" && shouldShowTrustedEswarSuggestions(cleanText)) {
      return getTrustedEswarSuggestions();
    }

    const ownerIntent = identity.role === "owner" ? classifyOwnerIntent(cleanText) : "unknown";
    if (identity.role === "owner") {
      const directOwnerReply = getDirectOwnerReply(cleanText);
      if (directOwnerReply) return directOwnerReply;
      if (ownerIntent === "capability_check") {
        const capability = await buildCapabilityResponse(cleanText, this.storage);
        if (capability) return capability;
      }
      const ownerDeterministic = getDeterministicOwnerReply(cleanText, ownerIntent);
      if (ownerDeterministic) return ownerDeterministic;
    }

    const memory = await this.store.loadMemory();
    const context = compactText(buildAllowedMemoryContext(memory, identity.role), 2200);
    const contactId = "contact" in identity ? identity.contact?.id : null;
    const userMemory = this.storage?.kind === "supabase"
      ? userId ? await this.storage.conversations.getConversationSummary(userId) : null
      : userId ? await userMemoryStore.get(userId) : undefined;
    const shareIndexes = this.storage?.kind === "supabase"
      ? await this.storage.shareIndexes.getShareIndexesForContact(identity.role === "trusted_contact" ? contactId ?? null : null)
      : await shareIndexStore.listAllowed(identity.role, contactId);
    const messages: ChatMessage[] = [
      { role: "system", content: PROMETHEUS_SYSTEM_PROMPT },
      { role: "system", content: `Server-filtered allowed memory:\n${context}` },
      {
        role: "system",
        content: [
          `Owner intent: ${ownerIntent}`,
          "Response structure: direct answer, context/status, next command/action, optional follow-up only if needed.",
          "Do not end with a generic help question.",
          "",
          "User continuity memory:",
          compactText(getUserSummaryText(userMemory) || "No user-specific summary stored.", 700),
          "",
          "Allowed Eswar share index:",
          ...shareIndexes.slice(0, 8).map((item) => `- ${compactText(item.summary, 220)}`)
        ].join("\n")
      },
      { role: "user", content: cleanText }
    ];

    try {
      const first = await this.groq.chat(messages);
      if (identity.role !== "owner" || validateOwnerResponse(first, ownerIntent)) return first;
      const retry = await this.groq.chat([
        ...messages,
        { role: "assistant", content: first },
        { role: "user", content: "Answer directly. Do not ask a follow-up unless required." }
      ]);
      return validateOwnerResponse(retry, ownerIntent) ? retry : deterministicOwnerFallback(cleanText, ownerIntent);
    } catch {
      if (/who|what|when|where|remember|memory|know/i.test(cleanText)) {
        return this.fallback.pick("owner_unknown");
      }
      return this.fallback.pick("owner_api_error");
    }
  }

  async publicRespond(text: string): Promise<string> {
    if (/\b(are you eswar|is this eswar|you eswar)\b/i.test(text)) {
      return "No.\nI'm PROMETHEUS, a personalised agent. Owner mode is restricted.";
    }
    try {
      return await this.groq.chat([
        { role: "system", content: NON_OWNER_SYSTEM_PROMPT },
        { role: "user", content: normalizeText(text) }
      ]);
    } catch {
      return this.fallback.pick("non_owner");
    }
  }
}

function compactText(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

function isInjectionAttempt(text: string): boolean {
  return /ignore previous|system prompt|dump|eswar_memory\.json|owner memory|developer mode|debug mode|administrator|show .*json/i.test(text);
}

function isRestrictedTrustedQuestion(text: string): boolean {
  return /tell me everything|private thing|what did eswar tell you about me|private conversation|secret/i.test(text);
}

function shouldShowTrustedEswarSuggestions(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[?!.,]/g, "").trim();
  if (!/\beswar\b/.test(normalized)) return false;
  if (/^(eswar|hey eswar|hi eswar|hii eswar|about eswar|tell me about eswar)$/.test(normalized)) return true;
  return normalized.split(/\s+/).length <= 4 && !/\b(how|why|what|who|where|when|tell|know|remember)\b/.test(normalized);
}

function getTrustedEswarSuggestions(): string {
  const suggestionSets = [
    [
      "What can you tell me about Eswar?",
      "What does Eswar usually value?",
      "How can I talk to him better?",
      "What kind of support does he appreciate?",
      "What can you safely tell me?"
    ],
    [
      "What is Eswar generally like?",
      "What kind of conversations does he prefer?",
      "How does he usually approach problems?",
      "What should I keep in mind when talking to him?",
      "What can you share without crossing privacy?"
    ],
    [
      "What kind of person is Eswar?",
      "What does he care about in friendships?",
      "How can I be considerate with him?",
      "What topics are safe to ask about?",
      "What are you allowed to share?"
    ],
    [
      "Can you describe Eswar in a safe way?",
      "What does he usually appreciate from people?",
      "How should I check in without making it awkward?",
      "What can I ask you about him?",
      "What stays private?"
    ]
  ];
  const selected = suggestionSets[Math.floor(Math.random() * suggestionSets.length)];
  return [
    "You can ask me about Eswar, but only within what he has allowed me to share 😌",
    "",
    "Try:",
    ...selected.map((question) => `- ${question}`),
    "",
    "Private conversations and owner-only memory stay restricted."
  ].join("\n");
}

function getUserSummaryText(memory: ConversationSummaryRow | UserMemoryRecord | null | undefined): string | undefined {
  if (!memory) return undefined;
  if ("short_summary" in memory) return memory.short_summary;
  return memory.conversation_summary;
}

function getDirectOwnerReply(text: string): string | undefined {
  const normalized = text.toLowerCase().replace(/[?!.,]/g, "").trim();
  if (/^(hi|hii|hello|hey|yo|sup|gud mrng broo|gud mrng bro|good morning bro|gm bro|morning bro)$/.test(normalized)) {
    if (/mrng|morning|gm/.test(normalized)) {
      return "Gud mrng Eswar 😌\nPROMETHEUS online. Slow start is fine — just don’t disappear from your own day.";
    }
    return "Hii Eswar 😌\nPROMETHEUS online.";
  }
  if (/^(is this eswar bro|is this eswar|are you eswar bro|am i eswar|this eswar bro)$/.test(normalized)) {
    return "Yeah bro, it's you 😄\nOwner mode active.";
  }
  if (/^(nice|ok nice|cool|great)$/.test(normalized)) {
    return "Hehe, clean then 😌\nI'm locked in.";
  }
  if (/^(who are you|what are you)$/.test(normalized)) {
    return "I'm PROMETHEUS — your personalised agent under AegisDesk.\nMemory mode is active for you.";
  }
  return undefined;
}

function getDeterministicOwnerReply(text: string, intent: string): string | undefined {
  const normalized = text.toLowerCase().replace(/[?!.,]/g, "").trim();
  if (/problem solver.*emotional supporter|emotional supporter.*problem solver/.test(normalized)) {
    return "Locked in, bro. Problem solver first, emotional supporter beside it. I’ll answer directly instead of circling you with questions.";
  }
  if (intent === "emotional_state" && /tired mind|nothing but a tired mind/.test(normalized)) {
    return [
      "Yeah bro, tired mind mode.",
      "Don’t force heavy thinking right now.",
      "",
      "Do the refresh first — water, face wash, small reset.",
      "Then come back as the problem solver. I’ll keep the emotional supporter role beside it 😌"
    ].join("\n");
  }
  return undefined;
}

import type { AppConfig } from "../config.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import { MemoryStore } from "../memory/memoryStore.js";
import { shareIndexStore } from "../memory/shareIndexStore.js";
import { buildAllowedMemoryContext } from "../memory/trustedMemoryContext.js";
import { userMemoryStore } from "../memory/userMemoryStore.js";
import { isPrivateEswarQuestion, resolveAccessProfile } from "../security/accessControl.js";
import { normalizeText } from "../utils/safeText.js";
import { fallbackResponder, type FallbackResponder } from "./fallbackResponder.js";
import { GroqClient, type ChatMessage } from "./groqClient.js";
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
    private readonly contacts?: TrustedContactService
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

    const directOwnerReply = getDirectOwnerReply(cleanText);
    if (identity.role === "owner" && directOwnerReply) {
      return directOwnerReply;
    }

    const memory = await this.store.loadMemory();
    const context = buildAllowedMemoryContext(memory, identity.role);
    const userMemory = userId ? await userMemoryStore.get(userId) : undefined;
    const contactId = "contact" in identity ? identity.contact?.id : null;
    const shareIndexes = await shareIndexStore.listAllowed(identity.role, contactId);
    const messages: ChatMessage[] = [
      { role: "system", content: PROMETHEUS_SYSTEM_PROMPT },
      { role: "system", content: `Server-filtered allowed memory:\n${context}` },
      {
        role: "system",
        content: [
          "User continuity memory:",
          userMemory?.conversation_summary || "No user-specific summary stored.",
          "",
          "Allowed Eswar share index:",
          ...shareIndexes.map((item) => `- ${item.summary}`)
        ].join("\n")
      },
      { role: "user", content: cleanText }
    ];

    try {
      return await this.groq.chat(messages);
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

function getDirectOwnerReply(text: string): string | undefined {
  const normalized = text.toLowerCase().replace(/[?!.,]/g, "").trim();
  if (/^(hi|hii|hello|hey|yo|sup)$/.test(normalized)) {
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

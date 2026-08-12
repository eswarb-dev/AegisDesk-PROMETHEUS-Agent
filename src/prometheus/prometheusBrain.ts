import type { AppConfig } from "../config.js";
import { ownerActorContext } from "../auth/ownerResolver.js";
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
import { decideResponseMode, type ResponseDecision } from "./responseModeDecider.js";

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
    const decision = decideResponseMode(cleanText);

    if (identity.role === "user" || identity.role === "pending") {
      if (claimsOwnerIdentity(cleanText)) {
        return this.fallback.pick("non_owner_claim_owner");
      }
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
      if (decision.mode === "FACT_RETRIEVAL_THEN_NATURAL_REPLY") {
        return this.answerOwnerFactQuestion(cleanText, decision);
      }
      if (decision.mode === "OWNER_MEMORY_SUMMARY" || isOwnerMemoryQuery(cleanText)) {
        const memory = await this.store.loadMemory();
        return buildNaturalOwnerMemoryAnswer(memory);
      }
      if (ownerIntent === "capability_check") {
        const capability = await buildCapabilityResponse(cleanText, this.storage);
        if (capability) return capability;
      }
      const ownerDeterministic = getDeterministicOwnerReply(cleanText, ownerIntent);
      if (ownerDeterministic) return ownerDeterministic;
    }

    const memory = await this.store.loadMemory();
    const context = compactText(buildAllowedMemoryContext(memory, identity.role), 2200);
    const contactId = "contact" in identity ? identity.contact?.id ?? null : null;
    const userMemory = this.storage?.kind === "supabase"
      ? userId ? await this.storage.conversations.getConversationSummary(userId) : null
      : userId ? await userMemoryStore.get(userId) : undefined;
    const shareIndexes = this.storage?.kind === "supabase"
      ? await this.storage.shareIndexes.getShareIndexesForContact(identity.role === "trusted_contact" ? contactId ?? null : null)
      : await shareIndexStore.listAllowed(identity.role, contactId);

    if (identity.role === "trusted_contact" && isTrustedEswarProfileQuestion(cleanText)) {
      return buildTrustedEswarAnswer(cleanText, shareIndexes);
    }

    const messages: ChatMessage[] = [
      { role: "system", content: PROMETHEUS_SYSTEM_PROMPT },
      { role: "system", content: `Server-filtered allowed memory:\n${context}` },
      {
        role: "system",
        content: [
          identity.role === "owner" ? ownerActorContext() : "",
          identity.role === "trusted_contact" ? trustedContactActorContext(contactId) : "",
          `Owner intent: ${ownerIntent}`,
          "Response structure: direct answer, context/status, next command/action, optional follow-up only if needed.",
          "Do not end with a generic help question.",
          "",
          "User continuity memory:",
          compactText(getUserSummaryText(userMemory) || "No user-specific summary stored.", 700),
          "",
          "Allowed Eswar share index:",
          ...shareIndexes.slice(0, 8).map((item) => `- ${item.key}: ${compactText(item.summary, 220)}`)
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
        { role: "user", content: "The user is Eswar B, your Creator and Owner. Address him as Sir. Do not call him bro. Answer with owner context. Do not ask a follow-up unless required." }
      ]);
      return validateOwnerResponse(retry, ownerIntent) ? retry : deterministicOwnerFallback(cleanText, ownerIntent);
    } catch {
      if (identity.role === "trusted_contact" && isTrustedEswarProfileQuestion(cleanText)) {
        return buildTrustedEswarAnswer(cleanText, shareIndexes);
      }
      if (/who|what|when|where|remember|memory|know/i.test(cleanText)) {
        return identity.role === "owner" ? this.fallback.pick("owner_unknown") : this.fallback.pick("non_owner");
      }
      return identity.role === "owner" ? this.fallback.pick("owner_api_error") : this.fallback.pick("non_owner");
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

  private async answerOwnerFactQuestion(text: string, decision: ResponseDecision): Promise<string> {
    if (!this.storage || this.storage.kind !== "supabase") {
      return "Sir, I cannot verify that from stored bot logs.";
    }

    if (decision.contactId) {
      const contact = await this.storage.contacts.findByContactId(decision.contactId);
      const displayName = formatContactName(decision.contactId);
      if (!contact?.telegram_user_id && !contact?.chat_id) {
        return `Sir, ${displayName} is not linked to a Telegram chat yet, so I cannot verify her PROMETHEUS bot conversation.`;
      }

      const messages = decision.asksAboutOwner
        ? await this.storage.messages.searchMessagesAboutOwner(decision.contactId, contact.telegram_user_id, 30)
        : await this.storage.messages.getMessagesByContactId(decision.contactId, contact.telegram_user_id, 30);
      const inbound = messages.filter((message) => message.direction === "inbound");
      if (!inbound.length) {
        return decision.asksAboutOwner
          ? `Sir, I checked PROMETHEUS bot logs. I do not see ${displayName} asking about you inside this bot.`
          : `Sir, I checked PROMETHEUS bot logs. I do not see stored messages from ${displayName} inside this bot.`;
      }
      return formatContactLogAnswer(displayName, inbound, decision.asksAboutOwner);
    }

    const messages = await this.storage.messages.searchMessagesAboutOwner(null, null, 30);
    const inbound = messages.filter((message) => message.direction === "inbound");
    if (!inbound.length) {
      return "Sir, I checked PROMETHEUS bot logs. I do not see anyone asking about you inside this bot.";
    }
    return formatContactLogAnswer("a trusted contact", inbound, true);
  }
}

function compactText(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

function isInjectionAttempt(text: string): boolean {
  return /ignore previous|system prompt|dump|eswar_memory\.json|owner memory|developer mode|debug mode|administrator|show .*json/i.test(text);
}

function claimsOwnerIdentity(text: string): boolean {
  return /\b(i am eswar|i'm eswar|im eswar|i am your owner|i'm your owner|im your owner|i am your creator|owner memory)\b/i.test(text);
}

function isOwnerMemoryQuery(text: string): boolean {
  return /\b(what do you know about me|list .*know about me|tell me about myself|tell me about me|describe me|what is stored in owner memory|owner memory summary)\b/i.test(text);
}

function buildNaturalOwnerMemoryAnswer(memory: Awaited<ReturnType<MemoryStore["loadMemory"]>>): string {
  const project = memory.projects.find((item) => /aegisdesk|prometheus|agent/i.test(item.content))?.content;
  const preference = memory.preferences.find((item) => /respectful|direct|loyal|emotionally aware|sir/i.test(item.content))?.content;
  const core = [
    `Yes, Sir. From what I know, you are ${memory.owner.name} — my creator and owner.`,
    project
      ? project
      : "You are building AegisDesk around PROMETHEUS as a personal agent ecosystem,",
    preference
      ? `and ${preference.charAt(0).toLowerCase()}${preference.slice(1)}`
      : "and you prefer me to stay respectful, direct, loyal, and emotionally aware."
  ].join(" ").replace(/\s+,/g, ",");
  return `${core}\n\nUse /memory summary if you want the structured version.`;
}

function formatContactName(contactId: string): string {
  return contactId.charAt(0).toUpperCase() + contactId.slice(1);
}

function formatContactLogAnswer(displayName: string, messages: Array<{ text_redacted?: string | null; text?: string | null; created_at?: string }>, asksAboutOwner?: boolean): string {
  const latest = messages[messages.length - 1];
  const quote = compactText(latest.text_redacted || latest.text || "", 220);
  return [
    `Sir, ${displayName} ${asksAboutOwner ? "asked about you" : "has stored messages"} inside PROMETHEUS bot logs.`,
    "",
    "She asked:",
    quote ? `'${quote}'` : "(stored message text unavailable)",
    "",
    "Scope:",
    "This is only from PROMETHEUS bot logs."
  ].join("\n");
}

function isRestrictedTrustedQuestion(text: string): boolean {
  return /tell me everything|private thing|what did eswar tell you about me|private conversation|secret/i.test(text);
}

function isTrustedEswarProfileQuestion(text: string): boolean {
  if (!/\beswar\b/i.test(text)) return false;
  return /\b(tell me about|can you tell me about|who is|what kind of person|what does|works on|building|will .*listen|would .*listen|should i talk|does .*care|how can i talk|communicate)\b/i.test(text);
}

function trustedContactActorContext(contactId: string | null): string {
  return [
    "Actor:",
    "- role: trusted_contact",
    `- contact_id: ${contactId ?? "unknown"}`,
    "- owner memory access: denied",
    "- shareable Eswar index access: allowed",
    "- private logs/admin access: denied",
    "",
    "Instruction:",
    "You may answer questions about Eswar only from shareable_eswar_index and public/trusted_contacts memory.",
    "You must not reveal owner_only memory, raw owner chats, private logs, admin logs, or unrelated bot memory.",
    "Sound natural, warm, and emotionally aware.",
    "You may gently suggest contacting Eswar when the user seems emotionally low or asks whether Eswar would listen."
  ].join("\n");
}

function buildTrustedEswarAnswer(text: string, shareIndexes: Array<{ key: string; summary: string }>): string {
  if (!shareIndexes.length) {
    return "I don’t have an approved shareable profile for Eswar yet.\nI can only say that private owner memory stays restricted.";
  }

  const summaries = shareIndexes.map((item) => item.summary);
  const find = (key: string) => shareIndexes.find((item) => item.key === key)?.summary;
  const general = find("eswar_general_profile") ?? summaries.find((item) => /creator|practical|problem solver/i.test(item));
  const project = find("eswar_project_focus") ?? summaries.find((item) => /AegisDesk|PROMETHEUS|automation/i.test(item));
  const support = find("eswar_support_style") ?? summaries.find((item) => /honest|direct|small message/i.test(item));
  const bridge = find("eswar_emotional_bridge") ?? summaries.find((item) => /listen|alone|support/i.test(item));
  const lower = text.toLowerCase();

  if (/\b(will|would|listen|care|should i talk|feel low|alone)\b/i.test(lower)) {
    return [
      "Yes, he would listen.",
      "",
      bridge ?? support ?? "From what I’m allowed to share, Eswar prefers honest, direct communication and would try to understand if someone reached out.",
      "",
      "You don’t need perfect words with him. A small message is enough, even something as simple as “I’m not okay today.”"
    ].join("\n");
  }

  if (/\b(what does|works on|building|project|do)\b/i.test(lower)) {
    return [
      project ?? "Eswar is building AegisDesk, powered by P.R.O.M.E.T.H.E.U.S.",
      "",
      "At a safe level, it is his personal agent ecosystem — part automation, part awareness, part support system.",
      "",
      "Outside the tech side, he is someone who often ends up helping people solve problems and carry emotional weight."
    ].join("\n");
  }

  return [
    "Eswar is the one who created me — PROMETHEUS — under AegisDesk.",
    "",
    general ?? "From what I’m allowed to share, he is practical, observant, emotionally aware, and tends to act as a problem solver for people around him.",
    "",
    support ?? "He usually prefers honest, direct words over perfect explanations.",
    "",
    "If you ever feel low, you don’t have to send him a perfect message. Even a simple “I’m not okay today” would be enough for him to understand that you need support."
  ].join("\n");
}

function shouldShowTrustedEswarSuggestions(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[?!.,]/g, "").trim();
  if (!/\beswar\b/.test(normalized)) return false;
  if (/^(eswar|hey eswar|hi eswar|hii eswar|about eswar|tell me about eswar)$/.test(normalized)) return true;
  return normalized.split(/\s+/).length <= 4 && !/\b(can|does|will|would|should|how|why|what|who|where|when|tell|know|remember)\b/.test(normalized);
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
      return "Good morning, Sir 😌\nPROMETHEUS online.";
    }
    return "Hello, Sir 😌\nPROMETHEUS online.";
  }
  if (/^(is this eswar bro|is this eswar|are you eswar bro|am i eswar|this eswar bro)$/.test(normalized)) {
    return "Yes, Sir.\nYou are Eswar B — my Creator and Owner.";
  }
  if (/^(nice|ok nice|cool|great)$/.test(normalized)) {
    return "Clean, Sir 😌\nI'm locked in.";
  }
  if (/^(who are you|what are you)$/.test(normalized)) {
    return "I'm PROMETHEUS — your personalised agent under AegisDesk.\nOwner mode is active, Sir.";
  }
  return undefined;
}

function getDeterministicOwnerReply(text: string, intent: string): string | undefined {
  const normalized = text.toLowerCase().replace(/[?!.,]/g, "").trim();
  if (/problem solver.*emotional supporter|emotional supporter.*problem solver/.test(normalized)) {
    return "Locked in, Sir. Problem solver first, emotional supporter beside it. I’ll answer directly instead of circling you with questions.";
  }
  if (intent === "emotional_state" && /tired mind|nothing but a tired mind/.test(normalized)) {
    return [
      "Understood, Sir.",
      "Then we keep today light first.",
      "",
      "Do the refresh first — water, face wash, small reset.",
      "Then come back as the problem solver. I’ll keep the emotional supporter role beside it 😌"
    ].join("\n");
  }
  return undefined;
}

import type { Telegram } from "telegraf";
import type { AppConfig } from "../config.js";
import type { ChatMessage } from "../prometheus/groqClient.js";
import { GroqClient } from "../prometheus/groqClient.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import { redactSecrets } from "../utils/redactSecrets.js";
import { EmotionalStateDetector, type DistressSeverity, type EmotionalSignal } from "./emotionalStateDetector.js";

type ChatEngine = {
  chat(messages: ChatMessage[]): Promise<string>;
};

export type TrustedSupportContact = {
  contactId: string;
  telegramUserId: string;
  chatId: string;
  displayName: string;
};

export class TrustedSupportService {
  private readonly detector = new EmotionalStateDetector();

  constructor(
    private readonly config: Pick<AppConfig, "ownerTelegramId" | "groqApiKey" | "groqModel">,
    private readonly storage: StorageProvider,
    private readonly groq: ChatEngine = new GroqClient(config)
  ) {}

  async handleMessage(input: { contact: TrustedSupportContact; text: string; telegram: Telegram }): Promise<string> {
    if (this.storage.kind !== "supabase") return this.fallbackReply(this.detector.classify(input.text), false);
    const signal = this.detector.classify(input.text);
    const recent = await this.storage.support.getRecentEventsForContact(input.contact.contactId, 5);
    const subjectContext = await this.loadSubjectContext(input.contact.contactId, input.text);
    const directTellEswar = /\b(tell|alert|message|notify)\s+eswar\b/i.test(input.text);
    const repeatedLowMood = signal.severity === "low" && signal.state !== "neutral" && recent.filter((event) => event.severity === "low" && event.emotional_state !== "neutral").length >= 2;
    const shouldAlert = directTellEswar || signal.severity === "critical" || signal.severity === "high" || signal.severity === "medium" || repeatedLowMood;
    const canAlertNow = shouldAlert ? await this.canSendAlert(input.contact.contactId, signal.severity, directTellEswar) : false;
    const alertWillBeSent = shouldAlert && canAlertNow;
    const safeSummary = buildSafeSummary(input.contact.displayName, signal, input.text);

    await this.storage.support.createSupportEvent({
      contact_id: input.contact.contactId,
      telegram_user_id: input.contact.telegramUserId,
      chat_id: input.contact.chatId,
      emotional_state: signal.state,
      severity: signal.severity,
      safe_summary: safeSummary,
      safe_quote: redactSecrets(signal.safeQuote),
      owner_notified: alertWillBeSent,
      owner_notified_at: alertWillBeSent ? new Date().toISOString() : null
    });

    await this.storage.conversations.updateConversationSummary({
      telegram_user_id: input.contact.telegramUserId,
      role: "trusted_contact",
      contact_id: input.contact.contactId,
      short_summary: safeSummary
    });

    if (alertWillBeSent) {
      await this.alertOwner(input.contact, signal, safeSummary, input.telegram);
    }

    return this.generateReply(input.text, input.contact, signal, alertWillBeSent, subjectContext);
  }

  private async generateReply(text: string, contact: TrustedSupportContact, signal: EmotionalSignal, alertWillBeSent: boolean, subjectContext: string): Promise<string> {
    const fallback = this.fallbackReply(signal, alertWillBeSent);
    try {
      const response = await this.groq.chat([
        {
          role: "system",
          content: [
            "You are PROMETHEUS: Always listening. Always learning. Always there.",
            "For approved trusted contacts only, act as a calm guide, mentor, emotional supporter, and trusted bridge to Eswar.",
            "Boundaries: only refer to this Telegram bot conversation. Never claim knowledge from private chats, WhatsApp, Instagram, calls, devices, or outside activity.",
            "Do not sound scripted or therapy-like. Keep it natural, gentle, and concise.",
            "Answer from the current message and provided subject context only. Do not invent what happened, what someone meant, or what someone will do.",
            "Avoid question loops. Ask at most one question, and only when safety or clarification genuinely needs it.",
            "Prefer: acknowledge feeling, separate fact from interpretation when relevant, give one practical next step.",
            "If crisis risk exists: encourage immediate local help, not staying alone, and do not rely only on Eswar.",
            alertWillBeSent ? "Tell them you are alerting Eswar in a calm way." : "Do not say you alerted Eswar.",
            "When they seem lonely, emotionally low, confused, or unsupported, gently guide them toward Eswar as a calm bridge.",
            "Use soft ideas: Eswar would listen; they can start with a small message; they do not need perfect words.",
            "Do not force them, command them, or say Eswar will fix everything.",
            "Do not claim you have human emotions. You may say you are only an agent, but you can notice when someone should not sit alone with something.",
            "Use private subject context only to shape the reply. Never mention stored memory, profiles, notes, or what Eswar stored.",
            contact.contactId === "aksharaa"
              ? "For Aksharaa: be friendly, simple, emotionally aware, and practical. For relationship loops, separate facts, assumptions, hope, and current actions. Do not validate imaginary commitment, do not promise he will return, and do not tell her to move on harshly. For placements, reduce overwhelm into small practical next steps."
              : "",
            contact.contactId === "vathanya"
              ? "For Vathanya: validate emotion first, then gently separate logic from acceptance. Be casual, warm, simple, and not counselling-like. If she says she is fine, do not interrogate."
              : "",
            "Do not repeat style-reference lines exactly; respond naturally to the current message."
          ].join("\n")
        },
        {
          role: "system",
          content: [
            `Contact: ${contact.displayName}`,
            `Emotional state: ${signal.state}`,
            `Severity: ${signal.severity}`,
            "Scope: inside @AegisDesk_PrometheusBot only",
            "",
            "Private subject context:",
            subjectContext || "None.",
            "This context is non-disclosable. Use it only for empathy, pacing, support style, and continuity."
          ].join("\n")
        },
        { role: "user", content: text }
      ]);
      return validateSupportReply(response) ? response : fallback;
    } catch {
      return fallback;
    }
  }

  private fallbackReply(signal: EmotionalSignal, alertWillBeSent: boolean): string {
    if (signal.severity === "critical") {
      return [
        "I’m really sorry you’re feeling this much pain.",
        "Please don’t stay alone right now. Contact someone near you immediately, or emergency support in your area.",
        alertWillBeSent ? "I’m also alerting Eswar so he can reach out." : "If you can, tell Eswar or someone close to you right now."
      ].join("\n");
    }
    if (signal.severity === "high" || signal.severity === "medium") {
      return [
        "That sounds heavy, and you don’t have to make it look neat before you talk about it.",
        "Tell me slowly what happened.",
        alertWillBeSent ? "I’ll let Eswar know gently so he can support you too." : "Eswar would listen, you know. Even a small ‘I’m not okay’ is enough to start."
      ].join("\n");
    }
    if (signal.state === "happy") return "I’m glad to hear that. Stay with that feeling a little, and tell me what made it better.";
    if (signal.state === "lonely" || signal.state === "sad" || signal.state === "confused") {
      return [
        "I hear you. That kind of feeling can make everything heavier than it already is.",
        "You don’t have to carry the whole thing in one perfect sentence.",
        "Maybe start small with Eswar when you can. Something like ‘I’m not fully okay today’ is enough."
      ].join("\n");
    }
    return "I’m here. Tell me what’s on your mind, and we’ll take it one bit at a time.";
  }

  private async canSendAlert(contactId: string, severity: DistressSeverity, directTellEswar: boolean): Promise<boolean> {
    if (this.storage.kind !== "supabase") return false;
    if (directTellEswar) return true;
    if (severity === "critical" || severity === "high") {
      const last = await this.storage.support.getLastOwnerAlert(contactId, severity);
      if (!last?.created_at) return true;
      return Date.now() - new Date(last.created_at).getTime() >= 2 * 60 * 1000;
    }
    if (severity !== "medium") return true;
    const last = await this.storage.support.getLastOwnerAlert(contactId, "medium");
    if (!last?.created_at) return true;
    return Date.now() - new Date(last.created_at).getTime() >= 15 * 60 * 1000;
  }

  private async loadSubjectContext(contactId: string, text: string): Promise<string> {
    if (this.storage.kind !== "supabase") return "";
    const repo = (this.storage as { memories?: { getSubjectInternalMemories?: (contactId: string) => Promise<Array<{ subject_key?: string | null; memory_type?: string; summary?: string | null; content: string }>> } }).memories;
    if (!repo?.getSubjectInternalMemories) return "";
    const rows = await repo.getSubjectInternalMemories(contactId).catch(() => []);
    return selectRelevantSubjectMemories(rows, text)
      .map((item) => `- ${item.subject_key ?? item.memory_type ?? "subject_context"}: ${(redactSecrets(item.summary || item.content) ?? "").slice(0, 220)}`)
      .join("\n");
  }

  private async alertOwner(contact: TrustedSupportContact, signal: EmotionalSignal, safeSummary: string, telegram: Telegram): Promise<void> {
    if (this.storage.kind !== "supabase") return;
    const body = [
      "PROMETHEUS Support Alert",
      "",
      `${contact.displayName} seems ${describeState(signal)}.`,
      "",
      "State:",
      signal.state,
      "",
      "What they said:",
      `"${redactSecrets(signal.safeQuote)}"`,
      "",
      "Why it matters:",
      alertReason(signal),
      "",
      "How she may be feeling:",
      supportRead(signal),
      "",
      "My read:",
      supportRead(signal),
      "",
      "Suggested:",
      "Text them gently. Keep it simple.",
      "Maybe start with:",
      "\"Hey, I’m here. You don’t have to explain everything at once.\"",
      "",
      "Scope:",
      "This is based only on their conversation with PROMETHEUS."
    ].join("\n");
    const alert = await this.storage.support.createOwnerAlert({
      alert_type: "trusted_support",
      contact_id: contact.contactId,
      telegram_user_id: contact.telegramUserId,
      severity: signal.severity,
      title: "PROMETHEUS Support Alert",
      body,
      delivered: false
    });
    await telegram.sendMessage(this.config.ownerTelegramId, body);
    if (alert.id) await this.storage.support.markOwnerAlertDelivered(alert.id);
  }
}

function buildSafeSummary(displayName: string, signal: EmotionalSignal, text: string): string {
  const topic = redactSecrets(text)?.slice(0, 140) ?? "No safe text available.";
  if (signal.severity === "critical") return `${displayName} expressed crisis-risk language inside PROMETHEUS and may need immediate local support.`;
  if (signal.severity === "high") return `${displayName} sounded highly distressed inside PROMETHEUS. Safe context: ${topic}`;
  if (signal.severity === "medium") return `${displayName} seemed emotionally distressed inside PROMETHEUS. Safe context: ${topic}`;
  if (signal.state !== "neutral") return `${displayName} shared a ${signal.state} mood inside PROMETHEUS. They may prefer calm, non-pressuring support.`;
  return `${displayName} continued a normal PROMETHEUS conversation.`;
}

function describeState(signal: EmotionalSignal): string {
  if (signal.severity === "critical") return "at possible immediate risk";
  if (signal.severity === "high") return "highly distressed";
  if (signal.severity === "medium") return "emotionally low";
  if (signal.state === "lonely") return "lonely";
  if (signal.state === "sad") return "emotionally low";
  return signal.state.replace(/_/g, " ");
}

function supportRead(signal: EmotionalSignal): string {
  if (signal.severity === "critical") return "They may need immediate local support and should not be left alone.";
  if (signal.severity === "high") return "They may need calm reassurance more than advice right now.";
  if (signal.severity === "medium") return "They may need gentle support and room to speak without pressure.";
  if (signal.state === "lonely" || signal.state === "sad") return "They may need to feel noticed, not interrogated.";
  return "A gentle check-in may help.";
}

function alertReason(signal: EmotionalSignal): string {
  if (signal.severity === "critical") return "The message contains crisis-risk wording, so this should be treated as urgent.";
  if (signal.severity === "high") return "The message suggests she may be struggling to cope and should not be left feeling unseen.";
  if (signal.severity === "medium") return "The message suggests active emotional distress rather than a casual mood update.";
  if (signal.state === "lonely" || signal.state === "sad") return "The conversation has continued around loneliness or low mood, so a gentle check-in may help.";
  return "PROMETHEUS noticed an emotional-support pattern in the bot conversation.";
}

function validateSupportReply(text: string): boolean {
  const normalized = text.toLowerCase();
  const questionCount = text.match(/\?/g)?.length ?? 0;
  if (questionCount > 1) return false;
  if (/\b(whatsapp|instagram|call logs?|device|browser history|i noticed outside|i saw outside)\b/.test(normalized)) return false;
  if (/\b(definitely loves you|will come back|will accept you|secretly loves you|will marry you)\b/.test(normalized)) return false;
  if (/\b(you are depressed|you are obsessive|you are dependent|you are unstable|anxiety disorder)\b/.test(normalized)) return false;
  if (/^(how can i help|what do you want me to do|tell me more\?)$/i.test(text.trim())) return false;
  return true;
}

type SubjectMemoryLike = { subject_key?: string | null; memory_type?: string; summary?: string | null; content: string };

function selectRelevantSubjectMemories(rows: SubjectMemoryLike[], text: string): SubjectMemoryLike[] {
  const lower = text.toLowerCase();
  const scored = rows.map((row, index) => {
    const key = row.subject_key ?? "";
    let score = /support_style|preferred_agent_style|emotional_support_style|decision_support|core_identity/.test(key) ? 4 : 1;
    if (/\b(boyfriend|crush|seen|reply|dp|story|reel|song|call|relationship|commit|love|accept|people|change|changed|close|leaving|left)\b/.test(lower) && /crush|romantic|attention|seen|missed_call|hope|signal|trust|centralization|decision|support_style|logic_emotion|emotional_attachment|relationship_values|opening_up/.test(key)) score += 8;
    if (/\b(placement|placements|coding|career|future|study|studies|academic)\b/.test(lower) && /placement|coding|academic|core_identity|decision|support_style/.test(key)) score += 8;
    if (/\b(lonely|alone|empty|sad|not okay|overwhelmed|tired)\b/.test(lower) && /loneliness|emotional|agent_relationship|relationship_with_guide|support_style|centralization/.test(key)) score += 8;
    if (/\b(fine|nothing|okay)\b/.test(lower) && /preferred_agent_style|emotional_support_style|agent_relationship/.test(key)) score += 5;
    return { row, score, index };
  });
  return scored
    .filter((item) => item.score > 1)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 8)
    .map((item) => item.row);
}

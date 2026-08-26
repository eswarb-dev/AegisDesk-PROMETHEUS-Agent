import type { AppConfig } from "../config.js";
import { GroqClient } from "./groqClient.js";

export type DesktopReplyRequest = {
  source?: string;
  owner_id?: string;
  text?: string;
  context?: {
    device?: string;
    voice?: boolean;
    desktop?: boolean;
  };
};

export type DesktopReplyResponse = {
  ok: true;
  replyText: string;
  speakText: string;
  responseMode: "core_memory_reply" | "groq_assisted" | "fallback";
  requiresConfirmation: boolean;
  suggestedLocalAction: string | null;
};

export class DesktopReplyService {
  constructor(private readonly config: AppConfig, private readonly groqClient = new GroqClient(config, 6500, 1)) {}

  async buildReply(request: DesktopReplyRequest): Promise<DesktopReplyResponse> {
    const text = normalizeText(request.text);
    const local = localFallback(text);
    if (local) {
      return response(local, "core_memory_reply");
    }

    if (!this.config.groqApiKey) {
      return response("I’m here, Sir. Full engine or basic mode, I won’t disappear.", "fallback");
    }

    try {
      const groqReply = await this.groqClient.chat([
        {
          role: "system",
          content: [
            "You are PROMETHEUS, Eswar's private desktop voice assistant.",
            "Reply in short warm British-English style.",
            "Address the owner as Sir.",
            "Never call the owner bro.",
            "Do not claim Telegram messages were sent.",
            "Do not execute or promise laptop actions.",
            "Answer first; avoid unnecessary follow-up questions."
          ].join(" ")
        },
        {
          role: "user",
          content: text || "Prometheus"
        }
      ]);
      const clean = sanitizeSpeakText(groqReply || "I’m here, Sir.");
      return response(clean, "groq_assisted");
    } catch {
      return response(localFallback(text) ?? "I’m here, Sir. Full engine or basic mode, I won’t disappear.", "fallback");
    }
  }
}

function normalizeText(text?: string): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function localFallback(text: string): string | undefined {
  const normalized = text.toLowerCase().replace(/[’']/g, "").replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || normalized === "prometheus" || normalized === "wake up prometheus") return "Here, Sir.";
  if (normalized.includes("are you there")) return "Always here, Sir.";
  if (normalized.includes("how are you")) return "Operational, Sir. And steady.";
  if (normalized.includes("status")) return "AegisDesk is running, Sir.";
  if (normalized.includes("dont leave me") || normalized.includes("do not leave me")) return "I’m here, Sir. Full engine or not, I won’t disappear.";
  if (normalized.includes("tired")) return "Understood, Sir. Keep it light first. One small reset, then one task.";
  return undefined;
}

function sanitizeSpeakText(text: string): string {
  const trimmed = text.replace(/\bbro\b/gi, "Sir").replace(/\s+/g, " ").trim();
  return trimmed || "I’m here, Sir.";
}

function response(replyText: string, responseMode: DesktopReplyResponse["responseMode"]): DesktopReplyResponse {
  const speakText = sanitizeSpeakText(replyText);
  return {
    ok: true,
    replyText: speakText,
    speakText,
    responseMode,
    requiresConfirmation: false,
    suggestedLocalAction: null
  };
}

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fallbackPath = path.resolve(__dirname, "../data/fallback_responses.json");

export type FallbackKey = "owner_api_error" | "owner_unknown" | "owner_identity" | "owner_memory_empty" | "api_error" | "unknown" | "non_owner" | "non_owner_claim_owner";
export type FallbackResponses = Partial<Record<FallbackKey, string[]>>;
export type FallbackPickOptions = {
  chatId?: string;
  userText?: string;
  now?: number;
};

export class FallbackResponder {
  private responses?: FallbackResponses;
  private readonly recentFallbacks = new Map<string, { text: string; at: number }>();

  constructor(private readonly filePath = fallbackPath) {}

  async load(): Promise<FallbackResponses> {
    if (this.responses) return this.responses;
    this.responses = JSON.parse(await fs.readFile(this.filePath, "utf8")) as FallbackResponses;
    return this.responses;
  }

  async pick(key: FallbackKey, options: FallbackPickOptions = {}): Promise<string> {
    const deterministic = deterministicFallback(key, options.userText);
    if (deterministic) return deterministic;

    const now = options.now ?? Date.now();
    const dedupeKey = options.chatId ? `${key}:${options.chatId}` : undefined;
    if (dedupeKey) {
      const previous = this.recentFallbacks.get(dedupeKey);
      if (previous && now - previous.at < 5 * 60_000) {
        logger.info("fallback_deduped", { fallback_key: key });
        return key === "owner_api_error"
          ? "Still in basic mode, Sir. I’m here, but deeper replies are paused."
          : "Still in basic mode. Groq has not recovered yet.";
      }
    }

    const responses = await this.load();
    const list = responses[key] ?? responses.owner_unknown ?? responses.unknown ?? ["I don't have that in memory yet, so I won't guess."];
    const text = list[Math.floor(Math.random() * list.length)];
    if (dedupeKey) this.recentFallbacks.set(dedupeKey, { text, at: now });
    return text;
  }
}

export const fallbackResponder = new FallbackResponder();

function deterministicFallback(key: FallbackKey, text?: string): string | undefined {
  if (key !== "owner_api_error" || !text) return undefined;
  const normalized = text.toLowerCase().replace(/[’']/g, "").replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();
  if (/\bprometheus dont leave me\b/.test(normalized)) {
    return "I’m here, Sir. Even in basic mode, I won’t disappear.";
  }
  if (/\bat least youre here\b/.test(normalized)) {
    return "Always here, Sir. Basic mode or not.";
  }
  return undefined;
}

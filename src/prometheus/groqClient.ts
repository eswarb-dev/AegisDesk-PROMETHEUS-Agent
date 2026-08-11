import type { AppConfig } from "../config.js";
import { logger } from "../utils/logger.js";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GroqErrorType = "groq_429" | "groq_timeout" | "groq_network_error" | "groq_invalid_response";

export class GroqError extends Error {
  constructor(
    readonly type: GroqErrorType,
    message = type
  ) {
    super(message);
    this.name = "GroqError";
  }
}

export class GroqClient {
  constructor(
    private readonly config: Pick<AppConfig, "groqApiKey" | "groqModel">,
    private readonly timeoutMs = 12000,
    private readonly retries = 1
  ) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.config.groqApiKey) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    let lastError: GroqError | undefined;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.groqApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: this.config.groqModel,
            messages,
            temperature: 0.7,
            max_tokens: 700
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          if (response.status === 429) throw new GroqError("groq_429");
          throw new GroqError("groq_network_error");
        }

        const body = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = body.choices?.[0]?.message?.content?.trim();
        if (!content) throw new GroqError("groq_invalid_response");
        return content;
      } catch (error) {
        lastError = normalizeGroqError(error);
        logger.warn("groq_request_failed", { error_type: lastError.type, attempt });
        if (lastError.type === "groq_429" || attempt >= this.retries) break;
        await delay(350);
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new GroqError("groq_network_error");
  }
}

function normalizeGroqError(error: unknown): GroqError {
  if (error instanceof GroqError) return error;
  if (error instanceof DOMException && error.name === "AbortError") return new GroqError("groq_timeout");
  if (error instanceof Error && error.name === "AbortError") return new GroqError("groq_timeout");
  if (error instanceof SyntaxError) return new GroqError("groq_invalid_response");
  return new GroqError("groq_network_error");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

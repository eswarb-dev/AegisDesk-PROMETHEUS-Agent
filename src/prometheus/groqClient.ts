import type { AppConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { recordGroqFailure, recordGroqSuccess } from "./engineStatus.js";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GroqErrorType = "groq_429" | "groq_timeout" | "groq_network_error" | "groq_invalid_response" | "groq_auth_error" | "groq_unknown_error";
export type GroqChatResult =
  | { ok: true; content: string; model: string; latencyMs: number }
  | { ok: false; errorType: GroqErrorType; fallbackUsed: true; model?: string; latencyMs: number };
type GroqRuntimeConfig = Pick<AppConfig, "groqApiKey" | "groqModel"> & Partial<Pick<AppConfig, "groqModelPrimary" | "groqModelFallback">>;

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
    private readonly config: GroqRuntimeConfig,
    private readonly timeoutMs = 12000,
    private readonly retries = 1
  ) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    const result = await this.chatWithStatus(messages);
    if (result.ok) return result.content;
    throw new GroqError(result.errorType);
  }

  async chatWithStatus(messages: ChatMessage[]): Promise<GroqChatResult> {
    const startedAt = Date.now();
    if (!this.config.groqApiKey) {
      recordGroqFailure("groq_auth_error");
      return { ok: false, errorType: "groq_auth_error", fallbackUsed: true, latencyMs: Date.now() - startedAt };
    }

    const models = this.getModelPlan();
    let lastError: GroqError | undefined;
    for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
      const model = models[modelIndex];
      const maxAttempts = modelIndex === 0 ? this.retries : 0;
      for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
        try {
          const content = await this.requestChat(messages, model);
          recordGroqSuccess(model);
          logger.info("groq_success", { model });
          return { ok: true, content, model, latencyMs: Date.now() - startedAt };
        } catch (error) {
          lastError = normalizeGroqError(error);
          recordGroqFailure(lastError.type, model);
          logger.warn(lastError.type, { error_type: lastError.type, model, attempt });
          if (lastError.type === "groq_429" || lastError.type === "groq_auth_error") {
            return { ok: false, errorType: lastError.type, fallbackUsed: true, model, latencyMs: Date.now() - startedAt };
          }
          if (attempt < maxAttempts) {
            await delay(350);
            continue;
          }
          if (!shouldTryFallbackModel(lastError.type) || modelIndex >= models.length - 1) {
            return { ok: false, errorType: lastError.type, fallbackUsed: true, model, latencyMs: Date.now() - startedAt };
          }
        }
      }
    }

    const errorType = lastError?.type ?? "groq_unknown_error";
    recordGroqFailure(errorType);
    return { ok: false, errorType, fallbackUsed: true, latencyMs: Date.now() - startedAt };
  }

  async healthCheck(): Promise<GroqChatResult> {
    return this.chatWithStatus([{ role: "user", content: "reply ok" }]);
  }

  private getModelPlan(): string[] {
    const primary = this.config.groqModelPrimary ?? this.config.groqModel;
    const fallback = this.config.groqModelFallback;
    return [primary, fallback].filter((model, index, all): model is string => Boolean(model) && all.indexOf(model) === index);
  }

  private async requestChat(messages: ChatMessage[], model: string): Promise<string> {
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
            model,
            messages,
            temperature: 0.7,
            max_tokens: 700
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          if (response.status === 429) throw new GroqError("groq_429");
          if (response.status === 401 || response.status === 403) throw new GroqError("groq_auth_error");
          if (response.status >= 500) throw new GroqError("groq_network_error");
          throw new GroqError("groq_invalid_response");
        }

        const body = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = body.choices?.[0]?.message?.content?.trim();
        if (!content) throw new GroqError("groq_invalid_response");
        return content;
      } finally {
        clearTimeout(timer);
      }
  }
}

function normalizeGroqError(error: unknown): GroqError {
  if (error instanceof GroqError) return error;
  if (error instanceof DOMException && error.name === "AbortError") return new GroqError("groq_timeout");
  if (error instanceof Error && error.name === "AbortError") return new GroqError("groq_timeout");
  if (error instanceof SyntaxError) return new GroqError("groq_invalid_response");
  if (error instanceof TypeError) return new GroqError("groq_network_error");
  return new GroqError("groq_unknown_error");
}

function shouldTryFallbackModel(type: GroqErrorType): boolean {
  return type === "groq_timeout" || type === "groq_network_error" || type === "groq_invalid_response" || type === "groq_unknown_error";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

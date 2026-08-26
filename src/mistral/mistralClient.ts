import type { ChatMessage } from "../prometheus/groqClient.js";
import { logger } from "../utils/logger.js";
import { classifyMistralError, MistralError, shouldRetryMistral } from "./mistralErrorClassifier.js";
import type { MistralChatResult } from "./mistralTypes.js";

export type MistralClientConfig = {
  apiKey?: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
};

export class MistralClient {
  constructor(private readonly config: MistralClientConfig) {}

  async chat(messages: ChatMessage[]): Promise<MistralChatResult> {
    const startedAt = Date.now();
    if (!this.config.apiKey) {
      return this.failure("mistral_auth_error", startedAt);
    }

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        const text = await this.request(messages);
        return { ok: true, provider: "mistral", model: this.config.model, text, latencyMs: Date.now() - startedAt };
      } catch (error) {
        const type = classifyMistralError(error);
        logger.warn(type, { error_type: type, model: this.config.model, attempt });
        if (!shouldRetryMistral(type) || attempt >= this.config.maxRetries) return this.failure(type, startedAt);
        await delay(350);
      }
    }
    return this.failure("mistral_unknown_error", startedAt);
  }

  private async request(messages: ChatMessage[]): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: 0.2,
          max_tokens: 1200
        }),
        signal: controller.signal
      });
      if (!response.ok) {
        if (response.status === 429) throw new MistralError("mistral_429");
        if (response.status === 401 || response.status === 403) throw new MistralError("mistral_auth_error");
        if (response.status >= 500) throw new MistralError("mistral_network_error");
        throw new MistralError("mistral_invalid_response");
      }
      const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) throw new MistralError("mistral_invalid_response");
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  private failure(errorType: MistralChatResult extends infer T ? T extends { ok: false; errorType: infer E } ? E : never : never, startedAt: number): MistralChatResult {
    return {
      ok: false,
      provider: "mistral",
      model: this.config.model,
      errorType,
      message: errorType,
      latencyMs: Date.now() - startedAt
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

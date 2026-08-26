import type { ChatMessage } from "../../prometheus/groqClient.js";
import { GroqError } from "../../prometheus/groqClient.js";
import type { CodingProvider, CodingProviderResult } from "./codingProviderTypes.js";

type ChatEngine = {
  chat(messages: ChatMessage[]): Promise<string>;
};

export class GroqCodingProvider implements CodingProvider {
  readonly provider = "groq" as const;

  constructor(
    private readonly engine: ChatEngine,
    readonly model: string
  ) {}

  async generate(messages: ChatMessage[]): Promise<CodingProviderResult> {
    const startedAt = Date.now();
    try {
      const text = await this.engine.chat(messages);
      return { ok: true, provider: "groq", model: this.model, text, latencyMs: Date.now() - startedAt };
    } catch (error) {
      const errorType = error instanceof GroqError ? error.type : "groq_unknown_error";
      return {
        ok: false,
        provider: "groq",
        model: this.model,
        errorType,
        message: errorType,
        latencyMs: Date.now() - startedAt
      };
    }
  }
}

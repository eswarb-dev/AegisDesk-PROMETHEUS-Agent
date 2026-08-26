import type { ChatMessage } from "../../prometheus/groqClient.js";
import type { CodingProviderErrorType } from "./codingProviderErrors.js";

export type CodingProviderName = "groq" | "mistral";

export type CodingProviderResult =
  | { ok: true; provider: CodingProviderName; model: string; text: string; latencyMs: number }
  | { ok: false; provider: CodingProviderName; model: string; errorType: CodingProviderErrorType; message: string; latencyMs: number };

export type CodingProvider = {
  provider: CodingProviderName;
  model: string;
  generate(messages: ChatMessage[]): Promise<CodingProviderResult>;
};

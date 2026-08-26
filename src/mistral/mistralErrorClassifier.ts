import type { MistralErrorType } from "./mistralTypes.js";

export class MistralError extends Error {
  constructor(readonly type: MistralErrorType, message = type) {
    super(message);
    this.name = "MistralError";
  }
}

export function classifyMistralError(error: unknown): MistralErrorType {
  if (error instanceof MistralError) return error.type;
  if (error instanceof DOMException && error.name === "AbortError") return "mistral_timeout";
  if (error instanceof Error && error.name === "AbortError") return "mistral_timeout";
  if (error instanceof SyntaxError) return "mistral_invalid_response";
  if (error instanceof TypeError) return "mistral_network_error";
  return "mistral_unknown_error";
}

export function shouldRetryMistral(type: MistralErrorType): boolean {
  return type === "mistral_timeout" || type === "mistral_network_error" || type === "mistral_unknown_error";
}

export type MistralErrorType =
  | "mistral_429"
  | "mistral_timeout"
  | "mistral_auth_error"
  | "mistral_network_error"
  | "mistral_invalid_response"
  | "mistral_unknown_error";

export type MistralChatResult =
  | { ok: true; provider: "mistral"; model: string; text: string; latencyMs: number }
  | { ok: false; provider: "mistral"; model: string; errorType: MistralErrorType; message: string; latencyMs: number };

export type CodingProviderErrorType =
  | "groq_429"
  | "groq_timeout"
  | "groq_network_error"
  | "groq_invalid_response"
  | "groq_auth_error"
  | "groq_unknown_error"
  | "mistral_429"
  | "mistral_timeout"
  | "mistral_auth_error"
  | "mistral_network_error"
  | "mistral_invalid_response"
  | "mistral_unknown_error";

export function shouldRepairProviderResponse(errorType: CodingProviderErrorType): boolean {
  return errorType === "groq_invalid_response" || errorType === "mistral_invalid_response";
}

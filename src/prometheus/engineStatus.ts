import type { AppConfig } from "../config.js";
import type { GroqErrorType } from "./groqClient.js";
import { logger } from "../utils/logger.js";

export type RuntimeGroqState = "unknown" | "ok" | "degraded";
export type MemoryHealth = "supabase_connected" | "supabase_degraded";

export const serviceStartedAt = Date.now();

let lastGroqSuccess: { at: number; model?: string } | null = null;
let lastGroqFailure: { at: number; type: GroqErrorType; model?: string } | null = null;
export type ConversationResponseSource = "deterministic" | "groq_primary" | "groq_fallback_model" | "static_fallback";
export type ConversationTrace = {
  requestTraceId: string;
  telegramMessageId?: number;
  responseRoute: string;
  detectedIntent: string;
  intentConfidence?: number;
  currentMessageChars: number;
  currentMessageApproxTokens: number;
  conversationContextApproxTokens: number;
  memoryContextApproxTokens: number;
  finalPromptApproxTokens: number;
  primaryModelAttempted?: string;
  primaryModelResult: "success" | "failed" | "not_attempted";
  fallbackModelAttempted?: string;
  fallbackModelResult: "success" | "failed" | "not_attempted";
  responseSource: ConversationResponseSource;
  responseChars: number;
};
let lastConversationTrace: ConversationTrace | null = null;
const coldStartNotices = new Set<string>();

export function recordGroqSuccess(model?: string): void {
  lastGroqSuccess = { at: Date.now(), model };
}

export function recordGroqFailure(type: GroqErrorType, model?: string): void {
  lastGroqFailure = { at: Date.now(), type, model };
}

export function getGroqState(): RuntimeGroqState {
  if (lastGroqFailure && (!lastGroqSuccess || lastGroqFailure.at > lastGroqSuccess.at)) return "degraded";
  if (lastGroqSuccess) return "ok";
  return "unknown";
}

export function getMemoryHealth(config: Pick<AppConfig, "databaseProvider" | "supabaseUrl" | "supabaseServiceRoleKey">): MemoryHealth {
  if (config.databaseProvider !== "supabase") return "supabase_degraded";
  return config.supabaseUrl && config.supabaseServiceRoleKey ? "supabase_connected" : "supabase_degraded";
}

export function recordConversationTrace(trace: ConversationTrace): void {
  lastConversationTrace = trace;
  if (process.env.NODE_ENV === "development") {
    logger.info("conversation_request_trace", {
      request_trace_id: trace.requestTraceId,
      telegram_message_id: trace.telegramMessageId,
      response_route: trace.responseRoute,
      detected_intent: trace.detectedIntent,
      intent_confidence: trace.intentConfidence,
      current_message_chars: trace.currentMessageChars,
      current_message_approx_tokens: trace.currentMessageApproxTokens,
      conversation_context_approx_tokens: trace.conversationContextApproxTokens,
      memory_context_approx_tokens: trace.memoryContextApproxTokens,
      final_prompt_approx_tokens: trace.finalPromptApproxTokens,
      primary_model_attempted: trace.primaryModelAttempted,
      primary_model_result: trace.primaryModelResult,
      fallback_model_attempted: trace.fallbackModelAttempted,
      fallback_model_result: trace.fallbackModelResult,
      response_source: trace.responseSource,
      response_chars: trace.responseChars
    });
  }
}

export function getLastConversationTrace(): ConversationTrace | null {
  return lastConversationTrace;
}

export function getEngineSnapshot(config: Pick<AppConfig, "databaseProvider" | "supabaseUrl" | "supabaseServiceRoleKey">) {
  return {
    serviceStartedAt,
    uptimeSeconds: Math.floor((Date.now() - serviceStartedAt) / 1000),
    memory: getMemoryHealth(config),
    groq: getGroqState(),
    lastGroqSuccess,
    lastGroqFailure,
    lastConversationTrace,
    fallback: "available" as const
  };
}

export function shouldSendColdStartNotice(key: string, now = Date.now()): boolean {
  if (now - serviceStartedAt > 20_000) return false;
  if (coldStartNotices.has(key)) return false;
  coldStartNotices.add(key);
  return true;
}

export function groqReason(type?: GroqErrorType): string {
  if (type === "groq_429") return "rate_limited";
  if (type === "groq_timeout") return "timeout";
  if (type === "groq_network_error") return "network_error";
  if (type === "groq_invalid_response") return "invalid_response";
  if (type === "groq_auth_error") return "auth_error";
  if (type === "groq_unknown_error") return "unknown_error";
  return "none";
}

export function relativeTime(at?: number | null, now = Date.now()): string {
  if (!at) return "never";
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

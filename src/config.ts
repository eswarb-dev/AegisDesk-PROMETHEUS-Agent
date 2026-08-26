import dotenv from "dotenv";
import type { CodingModeConfig } from "./coding/codingTypes.js";
import { normalizeDefaultCodeLanguage } from "./coding/languageResolver.js";

dotenv.config();

export type AppConfig = {
  telegramBotToken: string;
  groqApiKey?: string;
  groqModel: string;
  groqModelPrimary?: string;
  groqModelFallback?: string;
  ownerTelegramId: string;
  botPublicUrl?: string;
  databaseProvider: "json" | "supabase";
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseAnonKey?: string;
  nodeEnv: "development" | "test" | "production";
  port: number;
  botTimezone: string;
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  gmailRefreshToken?: string;
  gmailSenderEmail: string;
  gmailSenderName: string;
  gmailDraftsEnabled: boolean;
  desktopAgentSharedSecret?: string;
  coding?: CodingModeConfig;
  mistralApiKey?: string;
};

export function loadConfig(env = process.env): AppConfig {
  const nodeEnv = (env.NODE_ENV ?? "development") as AppConfig["nodeEnv"];
  const telegramBotToken = env.TELEGRAM_BOT_TOKEN ?? "";
  const ownerTelegramId = env.OWNER_TELEGRAM_ID ?? "";

  if (nodeEnv !== "test") {
    if (!telegramBotToken) throw new Error("TELEGRAM_BOT_TOKEN is required");
    if (!ownerTelegramId) throw new Error("OWNER_TELEGRAM_ID is required");
  }
  const databaseProvider = (env.DATABASE_PROVIDER ?? (env.SUPABASE_URL ? "supabase" : "json")) as AppConfig["databaseProvider"];
  if (nodeEnv === "production" && databaseProvider === "supabase") {
    if (!env.SUPABASE_URL) throw new Error("SUPABASE_URL is required when DATABASE_PROVIDER=supabase");
    if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required when DATABASE_PROVIDER=supabase");
  }

  return {
    telegramBotToken,
    groqApiKey: env.GROQ_API_KEY,
    groqModel: env.GROQ_MODEL_PRIMARY ?? env.GROQ_MODEL ?? "openai/gpt-oss-20b",
    groqModelPrimary: env.GROQ_MODEL_PRIMARY ?? env.GROQ_MODEL ?? "openai/gpt-oss-20b",
    groqModelFallback: env.GROQ_MODEL_FALLBACK ?? "qwen/qwen3.6-27b",
    ownerTelegramId,
    botPublicUrl: env.BOT_PUBLIC_URL,
    databaseProvider,
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    nodeEnv,
    port: Number(env.PORT ?? 3000),
    botTimezone: env.BOT_TIMEZONE ?? "Asia/Kolkata",
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: env.GOOGLE_REDIRECT_URI,
    gmailRefreshToken: env.GMAIL_REFRESH_TOKEN,
    gmailSenderEmail: env.GMAIL_SENDER_EMAIL ?? "prometheus.inference@gmail.com",
    gmailSenderName: env.GMAIL_SENDER_NAME ?? "PROMETHEUS",
    gmailDraftsEnabled: env.GMAIL_DRAFTS_ENABLED !== "false",
    desktopAgentSharedSecret: env.DESKTOP_AGENT_SHARED_SECRET,
    mistralApiKey: env.MISTRAL_API_KEY,
    coding: {
      enabled: env.CODING_MODE_ENABLED !== "false",
      defaultLanguage: normalizeDefaultCodeLanguage(env.DEFAULT_CODE_LANGUAGE),
      provider: env.CODING_PROVIDER === "mistral" ? "mistral" : "groq",
      providerFallback: env.CODING_PROVIDER_FALLBACK === "none" ? "none" : env.CODING_PROVIDER_FALLBACK === "groq" ? "groq" : "mistral",
      codeModel: env.GROQ_CODE_MODEL || undefined,
      codeModelFallback: env.GROQ_CODE_MODEL_FALLBACK || undefined,
      includeExplanation: env.CODING_INCLUDE_EXPLANATION !== "false",
      includeComplexity: env.CODING_INCLUDE_COMPLEXITY !== "false",
      includeTestCases: env.CODING_INCLUDE_TEST_CASES !== "false",
      mistralEnabled: env.MISTRAL_CODE_ENABLED !== "false",
      mistralCodeModel: env.MISTRAL_CODE_MODEL ?? "codestral-latest",
      mistralCodeModelFallback: env.MISTRAL_CODE_MODEL_FALLBACK || undefined,
      mistralTimeoutMs: Number(env.MISTRAL_CODE_TIMEOUT_MS ?? 30000),
      mistralMaxRetries: Number(env.MISTRAL_CODE_MAX_RETRIES ?? 1)
    }
  };
}

export const config = loadConfig();

export function defaultCodingConfig(): CodingModeConfig {
  return {
    enabled: true,
    defaultLanguage: "ask",
    provider: "groq",
    providerFallback: "mistral",
    includeExplanation: true,
    includeComplexity: true,
    includeTestCases: true,
    mistralEnabled: true,
    mistralCodeModel: "codestral-latest",
    mistralTimeoutMs: 30000,
    mistralMaxRetries: 1
  };
}

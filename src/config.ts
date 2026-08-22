import dotenv from "dotenv";

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
    gmailDraftsEnabled: env.GMAIL_DRAFTS_ENABLED !== "false"
  };
}

export const config = loadConfig();

import dotenv from "dotenv";

dotenv.config();

export type AppConfig = {
  telegramBotToken: string;
  groqApiKey?: string;
  groqModel: string;
  ownerTelegramId: string;
  botPublicUrl?: string;
  nodeEnv: "development" | "test" | "production";
  port: number;
};

export function loadConfig(env = process.env): AppConfig {
  const nodeEnv = (env.NODE_ENV ?? "development") as AppConfig["nodeEnv"];
  const telegramBotToken = env.TELEGRAM_BOT_TOKEN ?? "";
  const ownerTelegramId = env.OWNER_TELEGRAM_ID ?? "";

  if (nodeEnv !== "test") {
    if (!telegramBotToken) throw new Error("TELEGRAM_BOT_TOKEN is required");
    if (!ownerTelegramId) throw new Error("OWNER_TELEGRAM_ID is required");
  }

  return {
    telegramBotToken,
    groqApiKey: env.GROQ_API_KEY,
    groqModel: env.GROQ_MODEL ?? "llama-3.1-8b-instant",
    ownerTelegramId,
    botPublicUrl: env.BOT_PUBLIC_URL,
    nodeEnv,
    port: Number(env.PORT ?? 3000)
  };
}

export const config = loadConfig();

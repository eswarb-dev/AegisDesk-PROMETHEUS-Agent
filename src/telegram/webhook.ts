import type express from "express";
import type { Telegraf } from "telegraf";
import type { AppConfig } from "../config.js";

export const TELEGRAM_WEBHOOK_PATH = "/telegram/webhook";

export async function registerWebhook(app: express.Express, bot: Telegraf, config: AppConfig): Promise<void> {
  if (!config.botPublicUrl) throw new Error("BOT_PUBLIC_URL is required for webhook mode");
  app.use(await bot.createWebhook({ domain: config.botPublicUrl, path: TELEGRAM_WEBHOOK_PATH }));
}

import express from "express";
import type { Telegraf } from "telegraf";
import type { AppConfig } from "../config.js";
import { logger } from "../utils/logger.js";

export const TELEGRAM_WEBHOOK_PATH = "/telegram/webhook";

export async function registerWebhook(app: express.Express, bot: Telegraf, config: AppConfig): Promise<void> {
  if (!config.botPublicUrl) throw new Error("BOT_PUBLIC_URL is required for webhook mode");
  await bot.telegram.setWebhook(`${config.botPublicUrl}${TELEGRAM_WEBHOOK_PATH}`);
  app.post(TELEGRAM_WEBHOOK_PATH, express.json(), (req, res) => {
    res.sendStatus(200);
    void bot.handleUpdate(req.body).catch((error) => {
      logger.error("telegram_webhook_processing_failed", {
        error_type: "telegram_send_failed",
        error: error instanceof Error ? error.message : String(error)
      });
    });
  });
}

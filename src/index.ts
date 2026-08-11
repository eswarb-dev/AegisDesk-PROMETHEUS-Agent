import express from "express";
import type { Server } from "node:http";
import { config } from "./config.js";
import { memoryStore } from "./memory/memoryStore.js";
import { seedRuntimeData } from "./data/seedRuntimeData.js";
import { createBot } from "./telegram/bot.js";
import { registerCommandMenu } from "./telegram/menu.js";
import { TELEGRAM_WEBHOOK_PATH, registerWebhook } from "./telegram/webhook.js";
import { logger } from "./utils/logger.js";

export function createApp() {
  const app = express();
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "prometheus-telegram-chatbot" });
  });
  return app;
}

export async function main(): Promise<void> {
  await seedRuntimeData();
  const app = createApp();
  const bot = createBot(config, memoryStore);
  await registerCommandMenu(bot);

  if (config.nodeEnv === "production") {
    if (!config.botPublicUrl) throw new Error("BOT_PUBLIC_URL is required in production");
    await registerWebhook(app, bot, config);
  }

  const server: Server = app.listen(config.port, () => {
    logger.info("PROMETHEUS HTTP server listening", { port: config.port, webhook: TELEGRAM_WEBHOOK_PATH });
  });
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      logger.error(`Port ${config.port} is already in use. Set PORT to another value, for example PORT=3001.`);
      process.exit(1);
    }
    throw error;
  });

  if (config.nodeEnv !== "production") {
    await bot.launch();
    logger.info("PROMETHEUS long polling active");
  }

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error) => {
    logger.error("PROMETHEUS failed to start", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  });
}

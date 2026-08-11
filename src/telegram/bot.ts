import { Telegraf } from "telegraf";
import type { AppConfig } from "../config.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import { trustedContactStore } from "../contacts/trustedContactStore.js";
import { MemoryStore } from "../memory/memoryStore.js";
import { PrometheusBrain } from "../prometheus/prometheusBrain.js";
import { createStorageProvider } from "../storage/storageProvider.js";
import { registerCommands } from "./commandRouter.js";
import { registerMessageRouter } from "./messageRouter.js";
import { createMessageLoggingMiddleware } from "./messageLogging.js";
import { createTelegramRateLimitMiddleware } from "./rateLimiter.js";
import { createTelegramSendQueueMiddleware } from "./sendQueue.js";

export function createBot(config: AppConfig, store: MemoryStore): Telegraf {
  const bot = new Telegraf(config.telegramBotToken);
  const contacts = new TrustedContactService(config, trustedContactStore);
  const storage = createStorageProvider(config);
  const brain = new PrometheusBrain(config, store, undefined, undefined, contacts, storage);

  bot.use(createTelegramSendQueueMiddleware());
  bot.use(createTelegramRateLimitMiddleware(config, contacts, storage));
  bot.use(createMessageLoggingMiddleware(config, contacts, storage));
  registerCommands(bot, config, store, contacts, storage);
  registerMessageRouter(bot, brain, storage, config);

  return bot;
}

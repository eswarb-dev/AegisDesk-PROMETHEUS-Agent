import type { Context, MiddlewareFn } from "telegraf";
import { logger } from "../utils/logger.js";

export function createTelegramErrorBoundaryMiddleware(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    try {
      await next();
    } catch {
      logger.error("telegram_update_failed", { error_type: "telegram_update_failed" });
      try {
        await ctx.reply("PROMETHEUS hit a backend hiccup while handling that. Try again in a few seconds.");
      } catch {
        logger.error("telegram_error_reply_failed", { error_type: "telegram_send_failed" });
      }
    }
  };
}

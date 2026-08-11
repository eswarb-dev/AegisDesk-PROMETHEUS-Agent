import type { Context, MiddlewareFn } from "telegraf";
import { logger } from "../utils/logger.js";

export type TelegramSafeErrorType = "telegram_429" | "telegram_retry_after" | "telegram_send_failed";

type SendJob = {
  chatId: string;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  attempts: number;
};

export type TelegramSendQueueOptions = {
  perChatIntervalMs?: number;
  globalIntervalMs?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
};

export class TelegramSendQueue {
  private readonly perChatIntervalMs: number;
  private readonly globalIntervalMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly queue: SendJob[] = [];
  private readonly chatNextAt = new Map<string, number>();
  private globalNextAt = 0;
  private running = false;

  constructor(options: TelegramSendQueueOptions = {}) {
    this.perChatIntervalMs = options.perChatIntervalMs ?? 1000;
    this.globalIntervalMs = options.globalIntervalMs ?? 40;
    this.maxRetries = options.maxRetries ?? 2;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  enqueue<T>(chatId: string | number, execute: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        chatId: String(chatId),
        execute,
        resolve: resolve as (value: unknown) => void,
        reject,
        attempts: 0
      });
      void this.drain();
    });
  }

  async sendMessage<T>(
    telegram: { sendMessage(chatId: string | number, text: string, ...args: unknown[]): Promise<T> },
    chatId: string | number,
    text: string,
    ...args: unknown[]
  ): Promise<T[]> {
    const chunks = splitTelegramText(text);
    const results: T[] = [];
    for (const chunk of chunks) {
      results.push(await this.enqueue(chatId, () => telegram.sendMessage(chatId, chunk, ...args)));
    }
    return results;
  }

  async reply<T>(
    chatId: string | number,
    text: string,
    execute: (chunk: string) => Promise<T>
  ): Promise<T[]> {
    const chunks = splitTelegramText(text);
    const results: T[] = [];
    for (const chunk of chunks) {
      results.push(await this.enqueue(chatId, () => execute(chunk)));
    }
    return results;
  }

  async sendDocument<T>(
    sender: () => Promise<T>,
    chatId: string | number
  ): Promise<T> {
    return this.enqueue(chatId, sender);
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length > 0) {
        const job = this.queue.shift();
        if (!job) continue;
        const now = Date.now();
        const waitMs = Math.max(0, this.globalNextAt - now, (this.chatNextAt.get(job.chatId) ?? 0) - now);
        if (waitMs > 0) await this.sleep(waitMs);
        const sentAt = Date.now();
        this.globalNextAt = sentAt + this.globalIntervalMs;
        this.chatNextAt.set(job.chatId, sentAt + this.perChatIntervalMs);
        await this.runJob(job);
      }
    } finally {
      this.running = false;
    }
  }

  private async runJob(job: SendJob): Promise<void> {
    try {
      job.resolve(await job.execute());
    } catch (error) {
      const retryAfterMs = getRetryAfterMs(error);
      if (retryAfterMs != null && job.attempts < this.maxRetries) {
        logger.warn("telegram_send_failed", { error_type: "telegram_retry_after" satisfies TelegramSafeErrorType, retry_after_ms: retryAfterMs });
        await this.sleep(retryAfterMs);
      this.queue.unshift({ ...job, attempts: job.attempts + 1 });
        return;
      }
      logger.warn("telegram_send_failed", { error_type: retryAfterMs != null ? "telegram_429" : "telegram_send_failed" });
      job.reject(normalizeTelegramSendError(error));
    }
  }
}

function normalizeTelegramSendError(error: unknown): Error {
  if (error instanceof Error) return error;
  const retryAfterMs = getRetryAfterMs(error);
  return new Error(retryAfterMs != null ? "telegram_429" : "telegram_send_failed");
}

export const telegramSendQueue = new TelegramSendQueue();

export function createTelegramSendQueueMiddleware(queue = telegramSendQueue): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const originalReply = ctx.reply.bind(ctx);
    const originalSendMessage = ctx.telegram.sendMessage.bind(ctx.telegram);
    const originalReplyWithDocument = "replyWithDocument" in ctx && typeof ctx.replyWithDocument === "function"
      ? ctx.replyWithDocument.bind(ctx)
      : undefined;

    ctx.reply = (async (text: string, ...args: unknown[]) => {
      const chatId = ctx.chat?.id;
      if (chatId == null) return originalReply(text, ...(args as []));
      const results = await queue.reply(chatId, text, (chunk) => originalReply(chunk, ...(args as [])));
      return results[results.length - 1];
    }) as typeof ctx.reply;

    ctx.telegram.sendMessage = (async (chatId: string | number, text: string, ...args: unknown[]) => {
      const results = await queue.sendMessage({ sendMessage: originalSendMessage }, chatId, text, ...args);
      return results[results.length - 1];
    }) as typeof ctx.telegram.sendMessage;

    if (originalReplyWithDocument) {
      ctx.replyWithDocument = (async (...args: unknown[]) => {
        const chatId = ctx.chat?.id;
        if (chatId == null) return (originalReplyWithDocument as (...innerArgs: unknown[]) => Promise<unknown>)(...args);
        return queue.sendDocument(() => (originalReplyWithDocument as (...innerArgs: unknown[]) => Promise<unknown>)(...args), chatId);
      }) as typeof ctx.replyWithDocument;
    }

    await next();
  };
}

export function splitTelegramText(text: string, maxLength = 3900): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const slice = remaining.slice(0, maxLength);
    const breakAt = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
    const index = breakAt > maxLength * 0.6 ? breakAt : maxLength;
    chunks.push(remaining.slice(0, index).trimEnd());
    remaining = remaining.slice(index).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function getRetryAfterMs(error: unknown): number | null {
  const response = (error as { response?: { error_code?: number; parameters?: { retry_after?: number } } } | undefined)?.response;
  const retryAfter = response?.parameters?.retry_after;
  if (response?.error_code === 429 && typeof retryAfter === "number") return Math.max(0, retryAfter * 1000);
  return null;
}

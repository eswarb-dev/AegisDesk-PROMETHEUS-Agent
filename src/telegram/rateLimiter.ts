import type { Context, MiddlewareFn } from "telegraf";
import type { AppConfig } from "../config.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import type { UserRole } from "../memory/memoryTypes.js";
import type { StorageProvider } from "../storage/storageProvider.js";

const WINDOW_MS = 60_000;
export const TELEGRAM_COOLDOWN_MESSAGE = "Easy, I’m catching up 😌 Try again in a few seconds.";
export const TRUSTED_CONTACT_COOLDOWN_MESSAGE = "Give me a few seconds, I’m catching up 😌";

type Bucket = {
  timestamps: number[];
};

export class PerUserRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly cooldownNotices = new Map<string, number>();

  allow(userId: string | number, role: UserRole, now = Date.now()): boolean {
    const limit = limitForRole(role);
    const key = String(userId);
    const bucket = this.buckets.get(key) ?? { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);
    if (bucket.timestamps.length >= limit) {
      this.buckets.set(key, bucket);
      return false;
    }
    bucket.timestamps.push(now);
    this.buckets.set(key, bucket);
    return true;
  }

  reset(): void {
    this.buckets.clear();
    this.cooldownNotices.clear();
  }

  shouldNotifyCooldown(chatId: string | number, now = Date.now()): boolean {
    const key = String(chatId);
    const last = this.cooldownNotices.get(key);
    if (last != null && now - last < 30_000) return false;
    this.cooldownNotices.set(key, now);
    return true;
  }
}

export function createTelegramRateLimitMiddleware(
  config: Pick<AppConfig, "ownerTelegramId">,
  contacts: TrustedContactService,
  storage: StorageProvider,
  limiter = new PerUserRateLimiter()
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (!ctx.from?.id) {
      await next();
      return;
    }
    const role = await resolveRole(ctx.from.id, config, contacts, storage);
    if (!limiter.allow(ctx.from.id, role)) {
      const chatId = ctx.chat?.id ?? ctx.from.id;
      if (limiter.shouldNotifyCooldown(chatId)) {
        await ctx.reply(role === "trusted_contact" ? TRUSTED_CONTACT_COOLDOWN_MESSAGE : TELEGRAM_COOLDOWN_MESSAGE);
      }
      return;
    }
    await next();
  };
}

async function resolveRole(
  userId: number,
  config: Pick<AppConfig, "ownerTelegramId">,
  contacts: TrustedContactService,
  storage: StorageProvider
): Promise<UserRole> {
  if (String(userId) === String(config.ownerTelegramId)) return "owner";
  if (storage.kind === "supabase") {
    const user = await storage.users.getTelegramUserById(userId);
    if (user?.role === "trusted_contact") return "trusted_contact";
    const contact = await storage.contacts.findEnabledByTelegramId(userId);
    if (contact) return "trusted_contact";
    return user?.role ?? "user";
  }
  return (await contacts.resolveRole(userId)).role;
}

function limitForRole(role: UserRole): number {
  if (role === "owner") return 30;
  if (role === "trusted_contact") return 12;
  return 4;
}

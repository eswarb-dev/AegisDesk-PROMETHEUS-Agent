import type { Context, MiddlewareFn } from "telegraf";
import type { AppConfig } from "../config.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import type { UserRole } from "../memory/memoryTypes.js";
import type { StorageProvider } from "../storage/storageProvider.js";

const WINDOW_MS = 60_000;
export const TELEGRAM_COOLDOWN_MESSAGE = "Easy, I’m catching up 😌 Try again in a few seconds.";

type Bucket = {
  timestamps: number[];
};

export class PerUserRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

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
      await ctx.reply(TELEGRAM_COOLDOWN_MESSAGE);
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
    return user?.role ?? "user";
  }
  return (await contacts.resolveRole(userId)).role;
}

function limitForRole(role: UserRole): number {
  if (role === "owner") return 30;
  if (role === "trusted_contact") return 10;
  return 3;
}

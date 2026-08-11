import type { AppConfig } from "../config.js";
import { resolveAccessProfile } from "../security/accessControl.js";

export function isOwner(userId: number | undefined, config: Pick<AppConfig, "ownerTelegramId">): boolean {
  return resolveAccessProfile(userId, config).role === "owner";
}

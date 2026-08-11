import type { AppConfig } from "../config.js";
import type { UserRole } from "../memory/memoryTypes.js";

export type AccessProfile = {
  role: UserRole;
  canUsePrivateMemory: boolean;
  canUseMemoryCommands: boolean;
  canReceiveApprovedSharedMessages: boolean;
};

export function resolveAccessProfile(
  userId: number | undefined,
  config: Pick<AppConfig, "ownerTelegramId">
): AccessProfile {
  if (userId && String(userId) === String(config.ownerTelegramId)) {
    return {
      role: "owner",
      canUsePrivateMemory: true,
      canUseMemoryCommands: true,
      canReceiveApprovedSharedMessages: true
    };
  }

  return {
    role: "user",
    canUsePrivateMemory: false,
    canUseMemoryCommands: false,
    canReceiveApprovedSharedMessages: false
  };
}

export function isPrivateEswarQuestion(text: string): boolean {
  return /\b(eswar|owner|his|him)\b/i.test(text) && /\b(about|tell|memory|remember|know|private|personal|project|people|preference|where|who|what)\b/i.test(text);
}

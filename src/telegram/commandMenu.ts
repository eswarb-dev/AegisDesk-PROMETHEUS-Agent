import type { Telegram } from "telegraf";
import type { BotCommand } from "telegraf/types";
import type { UserRole } from "../memory/memoryTypes.js";
import type { TelegramUserRow } from "../storage/userRepository.js";
import { logger } from "../utils/logger.js";

export const PUBLIC_COMMANDS: BotCommand[] = [
  { command: "start", description: "Activate PROMETHEUS" },
  { command: "help", description: "Show commands" },
  { command: "about", description: "About PROMETHEUS" },
  { command: "ping", description: "Check connectivity" },
  { command: "play", description: "Open music search links" },
  { command: "privacy", description: "Memory/privacy policy" },
  { command: "forgetme", description: "Delete stored PROMETHEUS memory" },
  { command: "whoami", description: "Show Telegram ID and role" }
];

export const TRUSTED_CONTACT_COMMANDS: BotCommand[] = [
  ...PUBLIC_COMMANDS,
  { command: "supportoff", description: "Disable non-critical support memory" }
];

export const OWNER_COMMANDS: BotCommand[] = [
  { command: "start", description: "Activate PROMETHEUS" },
  { command: "help", description: "Show owner command groups" },
  { command: "about", description: "About PROMETHEUS" },
  { command: "ping", description: "Check connectivity" },
  { command: "whoami", description: "Show Telegram ID and role" },
  { command: "memory", description: "Memory status and controls" },
  { command: "contacts", description: "Trusted contact panel" },
  { command: "notify", description: "Broadcast owner message" },
  { command: "admin", description: "Owner admin/log command groups" },
  { command: "support", description: "Trusted support events" }
];

export async function registerDefaultCommands(telegram: Telegram): Promise<void> {
  if (!canSetCommands(telegram)) return;
  await safeSetMyCommands(telegram, PUBLIC_COMMANDS, { scope: { type: "default" } }, "default");
}

export async function registerOwnerCommands(telegram: Telegram, ownerChatId: string | number): Promise<void> {
  if (!canSetCommands(telegram)) return;
  await safeSetMyCommands(telegram, OWNER_COMMANDS, { scope: { type: "chat", chat_id: Number(ownerChatId) } }, "owner");
}

export async function registerTrustedContactCommands(telegram: Telegram, chatId: string | number): Promise<void> {
  if (!canSetCommands(telegram)) return;
  await safeSetMyCommands(telegram, TRUSTED_CONTACT_COMMANDS, { scope: { type: "chat", chat_id: Number(chatId) } }, "trusted_contact");
}

export async function registerPublicCommandsForChat(telegram: Telegram, chatId: string | number): Promise<void> {
  if (!canSetCommands(telegram)) return;
  await safeSetMyCommands(telegram, PUBLIC_COMMANDS, { scope: { type: "chat", chat_id: Number(chatId) } }, "public_chat");
}

export async function refreshCommandMenuForUser(
  telegram: Telegram,
  user: Pick<TelegramUserRow, "role" | "chat_id" | "telegram_user_id"> | { role: UserRole; chat_id?: string | number | null; telegram_user_id?: string | number }
): Promise<void> {
  const chatId = user.chat_id ?? user.telegram_user_id;
  if (chatId == null) return;
  if (user.role === "owner") {
    await registerOwnerCommands(telegram, chatId);
    return;
  }
  if (user.role === "trusted_contact") {
    await registerTrustedContactCommands(telegram, chatId);
    return;
  }
  await registerPublicCommandsForChat(telegram, chatId);
}

function canSetCommands(telegram: Telegram): boolean {
  return typeof (telegram as { setMyCommands?: unknown } | undefined)?.setMyCommands === "function";
}

async function safeSetMyCommands(
  telegram: Telegram,
  commands: BotCommand[],
  extra: Parameters<Telegram["setMyCommands"]>[1],
  scopeName: string
): Promise<void> {
  try {
    await telegram.setMyCommands(commands, extra);
  } catch {
    logger.warn("telegram_command_menu_failed", { error_type: "telegram_send_failed", scope: scopeName });
  }
}

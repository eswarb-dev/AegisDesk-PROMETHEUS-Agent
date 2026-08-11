import type { Telegraf } from "telegraf";

export const PROMETHEUS_COMMAND_MENU = [
  { command: "start", description: "Activate PROMETHEUS" },
  { command: "help", description: "Show available commands" },
  { command: "about", description: "About PROMETHEUS" },
  { command: "ping", description: "Check connectivity" },
  { command: "memory", description: "Show memory status" },
  { command: "whoami", description: "Show your access role" },
  { command: "contacts", description: "Owner: view trusted contacts" },
  { command: "trust", description: "Owner: approve trusted contact" },
  { command: "untrust", description: "Owner: revoke trusted access" },
  { command: "tell", description: "Owner: message trusted contact" },
  { command: "privacy", description: "Show memory privacy policy" },
  { command: "forgetme", description: "Delete your user memory" },
  { command: "shareindex", description: "Owner: list share index" },
  { command: "state", description: "Owner: manage shareable state" }
];

export async function registerCommandMenu(bot: Telegraf): Promise<void> {
  await bot.telegram.setMyCommands(PROMETHEUS_COMMAND_MENU);
}

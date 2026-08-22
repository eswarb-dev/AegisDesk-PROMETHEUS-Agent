import type { Telegraf } from "telegraf";
import type { AppConfig } from "../config.js";
import { adminCommand } from "../commands/admin.js";
import { aboutCommand } from "../commands/about.js";
import {
  auditCommand,
  chatCommand,
  exportCommand,
  logsCommand,
  memoryUserCommand,
  ownerContactsCommand,
  searchCommand,
  summaryCommand,
  usersCommand
} from "../commands/adminLogs.js";
import { contactsCommand } from "../commands/contacts.js";
import { engineCommand } from "../commands/engine.js";
import { forgetmeCommand } from "../commands/forgetme.js";
import { feedbackCommand } from "../commands/feedback.js";
import { helpCommand } from "../commands/help.js";
import { learningCommand } from "../commands/learning.js";
import { learnmodeCommand } from "../commands/learnmode.js";
import { memoryCommand } from "../commands/memory.js";
import { mailCommand } from "../commands/mail.js";
import { notifyCommand } from "../commands/notify.js";
import { pingCommand } from "../commands/ping.js";
import { playCommand } from "../commands/play.js";
import { privacyCommand } from "../commands/privacy.js";
import { shareindexCommand } from "../commands/shareindex.js";
import { startCommand } from "../commands/start.js";
import { stateCommand } from "../commands/state.js";
import { resetStyleCommand, styleCommand } from "../commands/style.js";
import { supportCommand, supportOffCommand } from "../commands/support.js";
import { tellCommand } from "../commands/tell.js";
import { trustCommand } from "../commands/trust.js";
import { untrustCommand } from "../commands/untrust.js";
import { whoamiCommand } from "../commands/whoami.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import { MemoryStore } from "../memory/memoryStore.js";
import type { StorageProvider } from "../storage/storageProvider.js";

export function registerCommands(
  bot: Telegraf,
  config: AppConfig,
  store: MemoryStore,
  contacts: TrustedContactService,
  storage: StorageProvider
): void {
  bot.start((ctx) => startCommand(ctx, config, store, contacts, storage));
  bot.help((ctx) => helpCommand(ctx, config, contacts, storage));
  bot.command("about", aboutCommand);
  bot.command("ping", pingCommand);
  bot.command("engine", (ctx) => engineCommand(ctx, config));
  bot.command("memory", (ctx) => memoryCommand(ctx, config, store, storage));
  bot.command("mail", (ctx) => mailCommand(ctx, config, storage));
  bot.command("notify", (ctx) => notifyCommand(ctx, config, storage));
  bot.command("play", playCommand);
  bot.command("feedback", (ctx) => feedbackCommand(ctx, storage));
  bot.command("style", (ctx) => styleCommand(ctx, storage));
  bot.command("resetstyle", (ctx) => resetStyleCommand(ctx, storage));
  bot.command("learnmode", (ctx) => learnmodeCommand(ctx, config, storage));
  bot.command("learning", (ctx) => learningCommand(ctx, config, storage));
  bot.command("users", (ctx) => usersCommand(ctx, config, storage));
  bot.command("contacts", (ctx) => storage.kind === "supabase" ? ownerContactsCommand(ctx, config, storage) : contactsCommand(ctx, config, contacts, storage));
  bot.command("logs", (ctx) => logsCommand(ctx, config, storage));
  bot.command("chat", (ctx) => chatCommand(ctx, config, storage));
  bot.command("search", (ctx) => searchCommand(ctx, config, storage));
  bot.command("summary", (ctx) => summaryCommand(ctx, config, storage));
  bot.command("export", (ctx) => exportCommand(ctx, config, storage));
  bot.command("audit", (ctx) => auditCommand(ctx, config, storage));
  bot.command("admin", (ctx) => adminCommand(ctx, config));
  bot.command("support", (ctx) => supportCommand(ctx, config, storage));
  bot.command("supportoff", (ctx) => supportOffCommand(ctx, storage));
  bot.command("trust", (ctx) => trustCommand(ctx, config, contacts, storage));
  bot.command("untrust", (ctx) => untrustCommand(ctx, config, contacts, storage));
  bot.command("whoami", (ctx) => whoamiCommand(ctx, contacts, config, storage));
  bot.command("tell", (ctx) => tellCommand(ctx, config, contacts, storage));
  bot.command("send_message", (ctx) => tellCommand(ctx, config, contacts, storage));
  bot.command("send", (ctx) => tellCommand(ctx, config, contacts, storage));
  bot.command("privacy", privacyCommand);
  bot.command("forgetme", (ctx) => forgetmeCommand(ctx, storage));
  bot.command("shareindex", (ctx) => shareindexCommand(ctx, config, storage));
  bot.command("state", (ctx) => stateCommand(ctx, config));
}

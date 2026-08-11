import type { Telegraf } from "telegraf";
import type { AppConfig } from "../config.js";
import { aboutCommand } from "../commands/about.js";
import { contactsCommand } from "../commands/contacts.js";
import { forgetmeCommand } from "../commands/forgetme.js";
import { helpCommand } from "../commands/help.js";
import { memoryCommand } from "../commands/memory.js";
import { pingCommand } from "../commands/ping.js";
import { privacyCommand } from "../commands/privacy.js";
import { shareindexCommand } from "../commands/shareindex.js";
import { startCommand } from "../commands/start.js";
import { stateCommand } from "../commands/state.js";
import { tellCommand } from "../commands/tell.js";
import { trustCommand } from "../commands/trust.js";
import { untrustCommand } from "../commands/untrust.js";
import { whoamiCommand } from "../commands/whoami.js";
import { TrustedContactService } from "../contacts/trustedContactService.js";
import { MemoryStore } from "../memory/memoryStore.js";

export function registerCommands(
  bot: Telegraf,
  config: Pick<AppConfig, "ownerTelegramId">,
  store: MemoryStore,
  contacts: TrustedContactService
): void {
  bot.start((ctx) => startCommand(ctx, config, store, contacts));
  bot.help(helpCommand);
  bot.command("about", aboutCommand);
  bot.command("ping", pingCommand);
  bot.command("memory", (ctx) => memoryCommand(ctx, config, store));
  bot.command("contacts", (ctx) => contactsCommand(ctx, config, contacts));
  bot.command("trust", (ctx) => trustCommand(ctx, config, contacts));
  bot.command("untrust", (ctx) => untrustCommand(ctx, config, contacts));
  bot.command("whoami", (ctx) => whoamiCommand(ctx, contacts, config));
  bot.command("tell", (ctx) => tellCommand(ctx, config, contacts));
  bot.command("privacy", privacyCommand);
  bot.command("forgetme", forgetmeCommand);
  bot.command("shareindex", (ctx) => shareindexCommand(ctx, config));
  bot.command("state", (ctx) => stateCommand(ctx, config));
}

import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isAllowedContactId } from "../contacts/trustedContactService.js";
import { isOwner } from "../memory/ownerMemory.js";
import type { StorageProvider } from "../storage/storageProvider.js";

const OWNER_RESTRICTED = "PROMETHEUS is active.\nThis command is owner-restricted.";

export async function supportCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, storage: StorageProvider): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply(OWNER_RESTRICTED);
    return;
  }
  if (storage.kind !== "supabase") {
    await ctx.reply("Supabase storage is required for trusted support events.");
    return;
  }

  const [arg] = getArgs(ctx);
  if (arg === "alerts") {
    const alerts = await storage.support.getOwnerAlerts();
    await ctx.reply(alerts.length ? ["PROMETHEUS support alerts", ...alerts.map((alert) => `${formatTime(alert.created_at)} ${alert.contact_id ?? "unknown"} ${alert.severity}: ${alert.title}`)].join("\n") : "No PROMETHEUS support alerts have been sent.");
    return;
  }
  if (arg === "settings") {
    await ctx.reply([
      "Trusted support settings",
      "Mode: approved trusted contacts only",
      "Medium alert cooldown: 15 minutes per contact",
      "High/critical alerts: immediate",
      "Scope: @AegisDesk_PrometheusBot conversations only",
      "Raw full conversations are not sent in alerts by default."
    ].join("\n"));
    return;
  }
  if (arg && !isAllowedContactId(arg)) {
    await ctx.reply("Usage: /support [aksharaa|vathanya|maddhurika|alerts|settings]");
    return;
  }

  const events = await storage.support.getRecentSupportEvents(arg ?? null);
  await ctx.reply(events.length ? ["Trusted support events", ...events.map((event) => `${formatTime(event.created_at)} ${event.contact_id} ${event.emotional_state}/${event.severity}: ${event.safe_summary}`)].join("\n\n").slice(0, 3900) : "No trusted support events found.");
}

export async function supportOffCommand(ctx: Context, storage: StorageProvider): Promise<void> {
  if (!ctx.from?.id) return;
  if (storage.kind !== "supabase") {
    await ctx.reply("Support memory controls require Supabase storage.");
    return;
  }
  const user = await storage.users.getTelegramUserById(ctx.from.id);
  if (user?.role !== "trusted_contact") {
    await ctx.reply("PROMETHEUS support memory controls are available only to approved trusted contacts.");
    return;
  }
  await storage.users.createOrUpdateTelegramUser({
    ...user,
    telegram_user_id: String(ctx.from.id),
    chat_id: String(ctx.chat?.id ?? user.chat_id ?? ctx.from.id),
    memory_enabled: false
  });
  await ctx.reply("Support memory is now off for non-critical continuity. If you express immediate danger, PROMETHEUS will still respond with safety support.");
}

function getArgs(ctx: Context): string[] {
  const message = ctx.message as { text?: string } | undefined;
  return (message?.text ?? "").trim().split(/\s+/).slice(1);
}

function formatTime(value?: string | null): string {
  if (!value) return "unknown time";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(value));
}

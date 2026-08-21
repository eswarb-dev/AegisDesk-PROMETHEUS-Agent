import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isOwner } from "../memory/ownerMemory.js";
import { getEngineSnapshot, groqReason, relativeTime } from "../prometheus/engineStatus.js";

export async function engineCommand(ctx: Context, config: AppConfig): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("PROMETHEUS is active.\nEngine status is owner-restricted.");
    return;
  }

  const snapshot = getEngineSnapshot(config);
  await ctx.reply([
    "PROMETHEUS Engine Status",
    "",
    "Render:",
    "awake",
    "",
    "Groq:",
    snapshot.groq,
    "reason:",
    groqReason(snapshot.lastGroqFailure?.type),
    "",
    "Memory:",
    snapshot.memory === "supabase_connected" ? "Supabase connected" : "Supabase degraded",
    "",
    "Fallback:",
    snapshot.fallback,
    "",
    "Last Groq success:",
    relativeTime(snapshot.lastGroqSuccess?.at),
    "",
    "Last Groq failure:",
    snapshot.lastGroqFailure ? `${snapshot.lastGroqFailure.type}, ${relativeTime(snapshot.lastGroqFailure.at)}` : "never"
  ].join("\n"));
}

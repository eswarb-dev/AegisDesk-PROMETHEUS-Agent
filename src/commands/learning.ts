import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isOwner } from "../memory/ownerMemory.js";
import type { StorageProvider } from "../storage/storageProvider.js";

export async function learningCommand(ctx: Context, config: AppConfig, storage: StorageProvider): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("PROMETHEUS learning events are owner-restricted.");
    return;
  }
  if (storage.kind !== "supabase") {
    await ctx.reply("Learning events need Supabase storage.");
    return;
  }
  const parts = ((ctx.message as { text?: string } | undefined)?.text ?? "").trim().split(/\s+/);
  const action = parts[1]?.toLowerCase();
  const id = parts[2];
  if ((action === "apply" || action === "reject") && id) {
    await storage.styles.markLearningEvent(id, action === "apply");
    await ctx.reply(`Learning event ${action === "apply" ? "applied" : "rejected"}.`);
    return;
  }

  const events = await storage.styles.listLearningEvents(8);
  if (!events.length) {
    await ctx.reply("No learning events recorded yet.");
    return;
  }
  await ctx.reply([
    "Recent PROMETHEUS Learning Events",
    "",
    ...events.map((event, index) => [
      `${index + 1}. ${event.event_type}`,
      `ID: ${event.id}`,
      `Confidence: ${event.confidence}`,
      `Applied: ${event.applied ? "yes" : "no"}`,
      event.observation
    ].join("\n"))
  ].join("\n\n"));
}

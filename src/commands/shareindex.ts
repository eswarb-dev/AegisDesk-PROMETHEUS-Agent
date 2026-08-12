import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { isOwner } from "../memory/ownerMemory.js";
import { shareIndexStore, type EswarShareIndex } from "../memory/shareIndexStore.js";
import type { StorageProvider } from "../storage/storageProvider.js";

export async function shareindexCommand(ctx: Context, config: Pick<AppConfig, "ownerTelegramId">, storage?: StorageProvider): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("Owner-only command.");
    return;
  }

  const message = ctx.message as { text?: string } | undefined;
  const [, subcommand = "list", arg] = (message?.text ?? "").trim().split(/\s+/);

  if (subcommand === "seed") {
    const seeded = storage?.kind === "supabase"
      ? await storage.shareIndexes.seedDefaultProfiles()
      : await shareIndexStore.seedDefaultProfiles();
    await ctx.reply([
      "Eswar share index seeded.",
      "",
      ...seeded.map((item) => `- ${item.key} (${item.visibility}, ${item.sensitivity})`)
    ].join("\n"));
    return;
  }

  if (subcommand === "preview") {
    if (!arg) {
      await ctx.reply("Usage: /shareindex preview <aksharaa|vathanya|maddhurika>");
      return;
    }
    const indexes = storage?.kind === "supabase"
      ? await storage.shareIndexes.getShareIndexesForContact(arg)
      : await shareIndexStore.listAllowed("trusted_contact", arg);
    await ctx.reply(formatPreview(arg, indexes));
    return;
  }

  if (subcommand !== "list") {
    await ctx.reply("Usage: /shareindex <seed|list|preview>");
    return;
  }

  const indexes = storage?.kind === "supabase"
    ? await storage.shareIndexes.listAll()
    : (await shareIndexStore.load()).indexes;
  await ctx.reply(
    [
      "Eswar Share Index",
      "",
      ...(indexes.length
        ? indexes.map((item) => `${item.key}\nVisibility: ${item.visibility}\nAllowed: ${item.allowed_contacts.join(", ") || "public/all"}\nSensitivity: ${item.sensitivity}\nExpires: ${item.expires_at ?? "never"}`)
        : ["No share indexes stored."])
    ].join("\n\n")
  );
}

function formatPreview(contactId: string, indexes: EswarShareIndex[]): string {
  return [
    `Share preview for ${contactId}`,
    "",
    ...(indexes.length
      ? indexes.map((item) => [
          item.key,
          `Visibility: ${item.visibility}`,
          `Sensitivity: ${item.sensitivity}`,
          `Summary: ${item.summary}`
        ].join("\n"))
      : ["No approved shareable Eswar profile exists for this contact yet."])
  ].join("\n\n");
}

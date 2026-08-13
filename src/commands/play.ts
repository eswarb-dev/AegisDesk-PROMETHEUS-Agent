import type { Context } from "telegraf";

export async function playCommand(ctx: Context): Promise<void> {
  const query = getQuery(ctx);
  if (!query) {
    await ctx.reply([
      "Usage: /play <song or artist>",
      "",
      "I cannot directly play audio from Telegram unless a device/music integration is connected.",
      "I can open a playable search link for you."
    ].join("\n"));
    return;
  }

  const encoded = encodeURIComponent(query);
  await ctx.reply([
    `I cannot directly control music playback from Telegram yet, Sir.`,
    "",
    `Play/search: ${query}`,
    "",
    `YouTube Music: https://music.youtube.com/search?q=${encoded}`,
    `Spotify: https://open.spotify.com/search/${encoded}`,
    "",
    "If you connect a real playback integration later, I can trigger that instead."
  ].join("\n"));
}

function getQuery(ctx: Context): string {
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  return text.replace(/^\/play(?:@\w+)?\s*/i, "").trim();
}

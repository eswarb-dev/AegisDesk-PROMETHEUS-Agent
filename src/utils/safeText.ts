export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 4000);
}

export function displayName(firstName?: string, lastName?: string, username?: string): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || username || "Telegram user";
}

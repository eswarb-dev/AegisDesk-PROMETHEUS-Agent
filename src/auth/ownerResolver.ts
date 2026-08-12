import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import type { ContactId } from "../contacts/trustedContactTypes.js";
import type { UserRole } from "../memory/memoryTypes.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import { displayName } from "../utils/safeText.js";

export type ActorIdentity = {
  telegramUserId: string;
  chatId: string;
  isOwner: boolean;
  role: UserRole;
  contactId: ContactId | null;
  displayName: string;
  addressAs: "Sir" | string;
  identityLabel: "creator" | "trusted_contact" | "public_user";
};

export async function resolveActor(
  ctx: Context,
  config: Pick<AppConfig, "ownerTelegramId">,
  storage?: StorageProvider
): Promise<ActorIdentity> {
  const telegramUserId = String(ctx.from?.id ?? "");
  const chatId = String(ctx.chat?.id ?? telegramUserId);
  const isOwner = telegramUserId !== "" && telegramUserId === String(config.ownerTelegramId);
  const name = displayName(ctx.from?.first_name, ctx.from?.last_name, ctx.from?.username);

  if (isOwner) {
    if (storage?.kind === "supabase") {
      await storage.users.repairOwnerIdentity({
        telegramUserId,
        chatId,
        username: ctx.from?.username ?? null,
        displayName: name
      }).catch(() => undefined);
    }
    return {
      telegramUserId,
      chatId,
      isOwner: true,
      role: "owner",
      contactId: null,
      displayName: name,
      addressAs: "Sir",
      identityLabel: "creator"
    };
  }

  const dbUser = storage?.kind === "supabase" && telegramUserId
    ? await storage.users.getTelegramUserById(telegramUserId).catch(() => null)
    : null;
  const role = dbUser?.role === "owner" ? "user" : dbUser?.role ?? "user";
  return {
    telegramUserId,
    chatId,
    isOwner: false,
    role,
    contactId: (dbUser?.contact_id as ContactId | null | undefined) ?? null,
    displayName: name,
    addressAs: name,
    identityLabel: role === "trusted_contact" ? "trusted_contact" : "public_user"
  };
}

export function ownerActorContext(): string {
  return [
    "Actor:",
    "- This user is Eswar B.",
    "- Eswar B is the Creator and Owner of PROMETHEUS.",
    "- Address him as Sir.",
    "- Do not call him bro.",
    "- Owner memory access is allowed.",
    "- Trusted-contact memory access is allowed only through owner commands.",
    "- Never describe him as a trusted contact or pending user."
  ].join("\n");
}

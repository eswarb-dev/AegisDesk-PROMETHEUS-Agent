import type { Telegram } from "telegraf";
import type { AppConfig } from "../config.js";
import type { StoredTelegramUser, UserRole } from "../memory/memoryTypes.js";
import { userMemoryStore } from "../memory/userMemoryStore.js";
import { logger } from "../utils/logger.js";
import { canSendAgentMessage, canSendWellbeingUpdate } from "./contactPermissions.js";
import { TrustedContactStore } from "./trustedContactStore.js";
import type { ContactId, ResolvedTelegramIdentity, TrustedContact } from "./trustedContactTypes.js";

function maskId(id: number): string {
  const text = String(id);
  return `${"*".repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`;
}

export class TrustedContactService {
  constructor(
    private readonly config: Pick<AppConfig, "ownerTelegramId">,
    private readonly store: TrustedContactStore
  ) {}

  async resolveRole(telegramUserId: number | undefined): Promise<ResolvedTelegramIdentity> {
    const isOwner = Boolean(telegramUserId && String(telegramUserId) === String(this.config.ownerTelegramId));
    logger.debug("owner detection", { from_id: telegramUserId, is_owner: isOwner });
    if (isOwner) {
      return { role: "owner" };
    }
    if (telegramUserId) {
      const contact = await this.store.findEnabledByTelegramId(telegramUserId);
      if (contact) return { role: "trusted_contact", contact };
    }
    return { role: "user" };
  }

  async registerPending(user: StoredTelegramUser): Promise<void> {
    if (user.role === "owner") return;
    await this.store.registerPending({ ...user, role: "pending", trusted: false });
  }

  async approve(telegramUserId: number, contactId: ContactId): Promise<TrustedContact> {
    const contact = await this.store.approve(telegramUserId, contactId);
    await userMemoryStore.upsertIdentity({
      telegram_user_id: telegramUserId,
      chat_id: contact.chat_id ?? telegramUserId,
      role: "trusted_contact",
      contact_id: contact.id,
      display_name: contact.name,
      username: contact.username
    });
    logger.info("trusted_contact approved", { contactId, telegram_id: maskId(telegramUserId) });
    return contact;
  }

  async revoke(contactId: ContactId): Promise<TrustedContact> {
    const before = await this.store.findContact(contactId);
    const contact = await this.store.revoke(contactId);
    if (before?.telegram_user_id) {
      await userMemoryStore.upsertIdentity({
        telegram_user_id: before.telegram_user_id,
        chat_id: before.chat_id ?? before.telegram_user_id,
        role: "user",
        contact_id: null,
        display_name: contact.name,
        username: before.username
      });
    }
    logger.info("trusted_contact revoked", { contactId });
    return contact;
  }

  async list() {
    return this.store.load();
  }

  async sendMessage(telegram: Telegram, contactId: ContactId, message: string, wellbeing = false): Promise<void> {
    const contact = await this.store.findContact(contactId);
    if (!contact) throw new Error("Unknown trusted contact id.");
    if (wellbeing ? !canSendWellbeingUpdate(contact) : !canSendAgentMessage(contact)) {
      throw new Error("Contact is not enabled or has no chat_id for messages.");
    }
    if (contact.chat_id == null) throw new Error("Contact has no chat_id for messages.");
    await telegram.sendMessage(contact.chat_id, message);
  }
}

export function isAllowedContactId(value: string): value is ContactId {
  return value === "aksharaa" || value === "vathanya" || value === "maddhurika";
}

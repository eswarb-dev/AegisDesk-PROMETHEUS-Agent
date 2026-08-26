import type { Context } from "telegraf";
import type { ContactId } from "./trustedContactTypes.js";
import type { StorageProvider } from "../storage/storageProvider.js";

export type OwnerRelayCommand = "tell" | "send_message" | "send";

export type OwnerRelayResult = {
  contactId: ContactId;
  chatId: string;
  telegramUserId: string;
  deliveredText: string;
};

export class TrustedContactMessagingService {
  constructor(private readonly storage: Extract<StorageProvider, { kind: "supabase" }>) {}

  async sendOwnerMessageToContact(input: {
    ctx: Context;
    contactId: ContactId;
    message: string;
    sourceCommand: OwnerRelayCommand;
  }): Promise<OwnerRelayResult> {
    const contact = await this.storage.contacts.repairChatIdFromTelegramUser(input.contactId);
    if (!contact?.enabled || !contact.telegram_user_id) {
      throw new Error(`${titleCase(input.contactId)} is not linked as an approved trusted contact.`);
    }
    if (contact.chat_id == null) {
      throw new Error(`${titleCase(input.contactId)} is linked by Telegram ID, but chat_id is missing.\nAsk them to send /start to PROMETHEUS again, then retry.`);
    }

    await input.ctx.telegram.sendMessage(contact.chat_id, input.message);
    await this.storage.messages.storeOutboundMessage({
      telegram_user_id: String(contact.telegram_user_id),
      chat_id: String(contact.chat_id),
      role: "trusted_contact",
      contact_id: input.contactId,
      message_type: "owner_relay",
      text: input.message,
      sender_role: "owner",
      sender_label: "owner_via_prometheus",
      source_command: input.sourceCommand,
      owner_initiated: true,
      visible_to_contact: true
    });

    return {
      contactId: input.contactId,
      chatId: String(contact.chat_id),
      telegramUserId: String(contact.telegram_user_id),
      deliveredText: input.message
    };
  }
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

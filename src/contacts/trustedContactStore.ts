import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StoredTelegramUser } from "../memory/memoryTypes.js";
import { defaultTrustedContactsData } from "../data/defaultData.js";
import type { ContactId, PendingTelegramUser, TrustedContact, TrustedContactsData } from "./trustedContactTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");

export class TrustedContactStore {
  private data?: TrustedContactsData;

  constructor(private readonly filePath = path.join(dataDir, "trusted_contacts.json")) {}

  async load(force = false): Promise<TrustedContactsData> {
    if (this.data && !force) return this.data;
    try {
      this.data = JSON.parse(await fs.readFile(this.filePath, "utf8")) as TrustedContactsData;
    } catch {
      this.data = structuredClone(defaultTrustedContactsData);
      await this.save(this.data);
    }
    this.data.pending_users ??= [];
    return this.data;
  }

  async save(data = this.data): Promise<void> {
    if (!data) return;
    await fs.writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    this.data = data;
  }

  async registerPending(user: StoredTelegramUser): Promise<PendingTelegramUser | undefined> {
    const data = await this.load();
    if (data.trusted_contacts.some((contact) => contact.enabled && contact.telegram_user_id === user.telegram_user_id)) {
      return undefined;
    }

    const pending: PendingTelegramUser = { ...user, role: "pending", trusted: false };
    const index = data.pending_users.findIndex((item) => item.telegram_user_id === user.telegram_user_id);
    if (index >= 0) {
      data.pending_users[index] = { ...data.pending_users[index], ...pending, created_at: data.pending_users[index].created_at };
    } else {
      data.pending_users.push(pending);
    }
    await this.save(data);
    return pending;
  }

  async findPending(telegramUserId: number): Promise<PendingTelegramUser | undefined> {
    return (await this.load()).pending_users.find((user) => user.telegram_user_id === telegramUserId);
  }

  async findContact(contactId: string): Promise<TrustedContact | undefined> {
    return (await this.load()).trusted_contacts.find((contact) => contact.id === contactId);
  }

  async findEnabledByTelegramId(telegramUserId: number): Promise<TrustedContact | undefined> {
    return (await this.load()).trusted_contacts.find(
      (contact) => contact.enabled && contact.telegram_user_id === telegramUserId
    );
  }

  async approve(telegramUserId: number, contactId: ContactId): Promise<TrustedContact> {
    const data = await this.load();
    const pending = data.pending_users.find((user) => user.telegram_user_id === telegramUserId);
    if (!pending) throw new Error("Telegram ID is not registered as pending. Ask them to run /start first.");

    const contact = data.trusted_contacts.find((item) => item.id === contactId);
    if (!contact) throw new Error("Unknown trusted contact id.");

    const now = new Date().toISOString();
    contact.telegram_user_id = pending.telegram_user_id;
    contact.chat_id = pending.chat_id;
    contact.username = pending.username ?? null;
    contact.enabled = true;
    contact.created_at ??= now;
    contact.approved_at = now;
    contact.last_seen = pending.last_seen;
    data.pending_users = data.pending_users.filter((user) => user.telegram_user_id !== telegramUserId);
    await this.save(data);
    return contact;
  }

  async revoke(contactId: ContactId): Promise<TrustedContact> {
    const data = await this.load();
    const contact = data.trusted_contacts.find((item) => item.id === contactId);
    if (!contact) throw new Error("Unknown trusted contact id.");
    contact.enabled = false;
    contact.telegram_user_id = null;
    contact.chat_id = null;
    await this.save(data);
    return contact;
  }
}

export const trustedContactStore = new TrustedContactStore();

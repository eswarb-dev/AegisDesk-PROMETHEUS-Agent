import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PersistentMemoryItem, UserRole } from "./memoryTypes.js";
import { defaultUserMemoriesData } from "../data/defaultData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");

export type UserMemoryRecord = {
  telegram_user_id: string;
  chat_id: string;
  role: UserRole;
  contact_id: string | null;
  display_name: string;
  username: string | null;
  memory_enabled: boolean;
  created_at: string;
  updated_at: string;
  last_seen: string;
  conversation_summary: string;
  preferences: PersistentMemoryItem[];
  important_context: PersistentMemoryItem[];
  safe_notes: PersistentMemoryItem[];
};

export type UserMemoriesData = {
  users: UserMemoryRecord[];
};

export class UserMemoryStore {
  private data?: UserMemoriesData;

  constructor(private readonly filePath = path.join(dataDir, "user_memories.json")) {}

  async load(force = false): Promise<UserMemoriesData> {
    if (this.data && !force) return this.data;
    try {
      this.data = JSON.parse(await fs.readFile(this.filePath, "utf8")) as UserMemoriesData;
    } catch {
      this.data = structuredClone(defaultUserMemoriesData);
      await this.save(this.data);
    }
    this.data.users ??= [];
    return this.data;
  }

  async save(data = this.data): Promise<void> {
    if (!data) return;
    await fs.writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    this.data = data;
  }

  async upsertIdentity(input: {
    telegram_user_id: number | string;
    chat_id: number | string;
    role: UserRole;
    contact_id?: string | null;
    display_name: string;
    username?: string | null;
  }): Promise<UserMemoryRecord> {
    const data = await this.load();
    const now = new Date().toISOString();
    const id = String(input.telegram_user_id);
    let record = data.users.find((user) => user.telegram_user_id === id);
    if (!record) {
      record = {
        telegram_user_id: id,
        chat_id: String(input.chat_id),
        role: input.role,
        contact_id: input.contact_id ?? null,
        display_name: input.display_name,
        username: input.username ?? null,
        memory_enabled: true,
        created_at: now,
        updated_at: now,
        last_seen: now,
        conversation_summary: "",
        preferences: [],
        important_context: [],
        safe_notes: []
      };
      data.users.push(record);
    } else {
      record.chat_id = String(input.chat_id);
      record.role = input.role;
      record.contact_id = input.contact_id ?? record.contact_id;
      record.display_name = input.display_name;
      record.username = input.username ?? null;
      record.updated_at = now;
      record.last_seen = now;
    }
    await this.save(data);
    return record;
  }

  async get(telegramUserId: number | string): Promise<UserMemoryRecord | undefined> {
    return (await this.load()).users.find((user) => user.telegram_user_id === String(telegramUserId));
  }

  async appendSafeSummary(telegramUserId: number | string, text: string): Promise<void> {
    const record = await this.get(telegramUserId);
    if (!record || !record.memory_enabled) return;
    const safe = summarizeSafely(text);
    if (!safe) return;
    const now = new Date().toISOString();
    record.conversation_summary = [record.conversation_summary, safe].filter(Boolean).join(" ").slice(-800);
    record.safe_notes.push({
      id: `mem_${Date.now()}`,
      owner_user_id: record.telegram_user_id,
      type: "conversation_summary",
      content: safe,
      visibility: "self_only",
      allowed_contacts: [],
      source: "conversation_summary",
      confidence: 0.6,
      sensitivity: "low",
      created_at: now,
      updated_at: now,
      expires_at: null,
      review_required: false
    });
    record.safe_notes = record.safe_notes.slice(-20);
    record.updated_at = now;
    await this.save();
  }

  async forget(telegramUserId: number | string): Promise<boolean> {
    const data = await this.load();
    const before = data.users.length;
    data.users = data.users.filter((user) => user.telegram_user_id !== String(telegramUserId));
    await this.save(data);
    return data.users.length !== before;
  }
}

function summarizeSafely(text: string): string | undefined {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 12) return undefined;
  if (/password|otp|token|api key|secret|private key|card|payment/i.test(clean)) return undefined;
  return `Last useful interaction summary: ${clean.slice(0, 220)}`;
}

export const userMemoryStore = new UserMemoryStore();

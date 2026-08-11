import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultEswarMemoryData } from "../data/defaultData.js";
import type { EswarMemory, StoredTelegramUser } from "./memoryTypes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");

export class MemoryStore {
  private memory?: EswarMemory;
  private users = new Map<number, StoredTelegramUser>();

  constructor(private memoryPath = path.join(dataDir, "eswar_memory.json")) {}

  async loadMemory(force = false): Promise<EswarMemory> {
    if (this.memory && !force) return this.memory;
    try {
      const raw = await fs.readFile(this.memoryPath, "utf8");
      this.memory = JSON.parse(raw) as EswarMemory;
    } catch {
      this.memory = structuredClone(defaultEswarMemoryData);
      await fs.mkdir(path.dirname(this.memoryPath), { recursive: true });
      await fs.writeFile(this.memoryPath, `${JSON.stringify(this.memory, null, 2)}\n`, "utf8");
    }
    return this.memory;
  }

  async reloadMemory(): Promise<EswarMemory> {
    return this.loadMemory(true);
  }

  upsertTelegramUser(user: Omit<StoredTelegramUser, "created_at" | "last_seen">): StoredTelegramUser {
    const now = new Date().toISOString();
    const existing = this.users.get(user.telegram_user_id);
    const stored: StoredTelegramUser = {
      ...user,
      created_at: existing?.created_at ?? now,
      last_seen: now
    };
    this.users.set(user.telegram_user_id, stored);
    return stored;
  }

  getTelegramUser(id: number): StoredTelegramUser | undefined {
    return this.users.get(id);
  }
}

export const memoryStore = new MemoryStore();

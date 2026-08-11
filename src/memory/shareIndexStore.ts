import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MemoryVisibility } from "./memoryTypes.js";
import { defaultShareIndexData } from "../data/defaultData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../data");

export type EswarShareIndex = {
  key: string;
  summary: string;
  visibility: MemoryVisibility;
  allowed_contacts: string[];
  sensitivity: "low" | "medium" | "high";
  source: "owner_approved";
  confidence: number;
  expires_at: string | null;
  safe_answer_style: string;
  blocked_details: string[];
  review_required?: boolean;
};

export type ShareIndexData = {
  indexes: EswarShareIndex[];
};

export class ShareIndexStore {
  private data?: ShareIndexData;
  constructor(private readonly filePath = path.join(dataDir, "eswar_share_index.json")) {}

  async load(force = false): Promise<ShareIndexData> {
    if (this.data && !force) return this.data;
    try {
      this.data = JSON.parse(await fs.readFile(this.filePath, "utf8")) as ShareIndexData;
    } catch {
      this.data = structuredClone(defaultShareIndexData);
      await this.save(this.data);
    }
    this.data.indexes ??= [];
    return this.data;
  }

  async save(data = this.data): Promise<void> {
    if (!data) return;
    await fs.writeFile(this.filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    this.data = data;
  }

  async listAllowed(role: string, contactId?: string | null): Promise<EswarShareIndex[]> {
    const now = Date.now();
    return (await this.load()).indexes.filter((item) => {
      if (item.expires_at && Date.parse(item.expires_at) < now) return false;
      if (role === "owner") return true;
      if (role !== "trusted_contact") return item.visibility === "public";
      if (item.visibility !== "trusted_contacts" && item.visibility !== "public") return false;
      return !item.allowed_contacts.length || Boolean(contactId && item.allowed_contacts.includes(contactId));
    });
  }

  async addState(summary: string): Promise<EswarShareIndex> {
    const data = await this.load();
    const key = `state_${Date.now()}`;
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const item: EswarShareIndex = {
      key,
      summary,
      visibility: "owner_only",
      allowed_contacts: [],
      sensitivity: "medium",
      source: "owner_approved",
      confidence: 1,
      expires_at: expires,
      safe_answer_style: "warm and general",
      blocked_details: ["private conversations", "unapproved personal events"],
      review_required: true
    };
    data.indexes.push(item);
    await this.save(data);
    return item;
  }

  async share(key: string, contactId: string | "all"): Promise<EswarShareIndex> {
    const data = await this.load();
    const item = data.indexes.find((index) => index.key === key);
    if (!item) throw new Error("Share index key not found.");
    item.visibility = "trusted_contacts";
    item.allowed_contacts = contactId === "all" ? ["aksharaa", "vathanya", "maddhurika"] : [contactId];
    await this.save(data);
    return item;
  }
}

export const shareIndexStore = new ShareIndexStore();

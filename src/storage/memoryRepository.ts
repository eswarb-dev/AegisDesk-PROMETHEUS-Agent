import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemoryVisibility, PersistentMemoryItem, UserRole } from "../memory/memoryTypes.js";
import { canAccessMemory } from "../memory/memoryAccess.js";

export type MemoryItemRow = Omit<PersistentMemoryItem, "id"> & {
  id?: string;
  subject_type: "owner" | "user" | "trusted_contact" | "share_index" | "conversation_summary";
  subject_key?: string | null;
  summary?: string | null;
};

export class MemoryRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async upsertMemoryItem(item: MemoryItemRow): Promise<MemoryItemRow> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("memory_items")
      .upsert(
        {
          ...item,
          updated_at: now
        },
        item.id ? { onConflict: "id" } : undefined
      )
      .select("*")
      .single();
    if (error) throw error;
    return data as MemoryItemRow;
  }

  async getOwnerMemories(): Promise<MemoryItemRow[]> {
    return this.getByVisibility(["owner_only", "trusted_contacts", "public"]);
  }

  async getOwnerMemorySummary(): Promise<string> {
    const memories = await this.getOwnerMemories();
    return memories
      .slice(0, 12)
      .map((item) => item.summary || item.content)
      .filter(Boolean)
      .join("\n");
  }

  async getOwnerMemoryNaturalFacts(): Promise<string[]> {
    const memories = await this.getOwnerMemories();
    return memories
      .filter((item) => item.sensitivity !== "high")
      .slice(0, 10)
      .map((item) => item.summary || item.content)
      .filter(Boolean);
  }

  async getSelfMemories(telegramUserId: string | number): Promise<MemoryItemRow[]> {
    const { data, error } = await this.supabase
      .from("memory_items")
      .select("*")
      .eq("owner_telegram_user_id", String(telegramUserId))
      .eq("visibility", "self_only")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    if (error) throw error;
    return data as MemoryItemRow[];
  }

  async getTrustedVisibleMemories(contactId: string): Promise<MemoryItemRow[]> {
    const memories = await this.getByVisibility(["trusted_contacts", "public"]);
    return memories.filter((item) => !item.allowed_contacts.length || item.allowed_contacts.includes(contactId));
  }

  async getPublicMemories(): Promise<MemoryItemRow[]> {
    return this.getByVisibility(["public"]);
  }

  async deleteMemoryItem(memoryId: string): Promise<void> {
    const { error } = await this.supabase.from("memory_items").delete().eq("id", memoryId);
    if (error) throw error;
  }

  async deleteSelfMemories(telegramUserId: string | number): Promise<void> {
    const { error } = await this.supabase
      .from("memory_items")
      .delete()
      .eq("owner_telegram_user_id", String(telegramUserId))
      .eq("visibility", "self_only");
    if (error) throw error;
  }

  async expireOldMemories(): Promise<void> {
    const { error } = await this.supabase
      .from("memory_items")
      .delete()
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString());
    if (error) throw error;
  }

  filterForRole(items: MemoryItemRow[], role: UserRole): MemoryItemRow[] {
    return items.filter((item) => canAccessMemory(role, item.visibility as MemoryVisibility));
  }

  async count(): Promise<number> {
    const { count, error } = await this.supabase.from("memory_items").select("id", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  }

  private async getByVisibility(visibilities: MemoryVisibility[]): Promise<MemoryItemRow[]> {
    const { data, error } = await this.supabase
      .from("memory_items")
      .select("*")
      .in("visibility", visibilities)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    if (error) throw error;
    return data as MemoryItemRow[];
  }
}

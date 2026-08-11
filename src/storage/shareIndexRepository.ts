import type { SupabaseClient } from "@supabase/supabase-js";
import type { EswarShareIndex } from "../memory/shareIndexStore.js";

export class ShareIndexRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async upsert(index: EswarShareIndex): Promise<EswarShareIndex> {
    const { data, error } = await this.supabase
      .from("eswar_share_index")
      .upsert({ ...index, updated_at: new Date().toISOString() }, { onConflict: "key" })
      .select("key, summary, visibility, allowed_contacts, sensitivity, source, confidence, expires_at, safe_answer_style, blocked_details")
      .single();
    if (error) throw error;
    return data as EswarShareIndex;
  }

  async getShareIndexesForContact(contactId: string | null): Promise<EswarShareIndex[]> {
    const { data, error } = await this.supabase
      .from("eswar_share_index")
      .select("key, summary, visibility, allowed_contacts, sensitivity, source, confidence, expires_at, safe_answer_style, blocked_details")
      .in("visibility", ["trusted_contacts", "public"])
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    if (error) throw error;
    return (data as EswarShareIndex[]).filter(
      (item) => item.visibility === "public" || !item.allowed_contacts.length || Boolean(contactId && item.allowed_contacts.includes(contactId))
    );
  }

  async getActiveShareIndexByKey(key: string): Promise<EswarShareIndex | null> {
    const { data, error } = await this.supabase
      .from("eswar_share_index")
      .select("key, summary, visibility, allowed_contacts, sensitivity, source, confidence, expires_at, safe_answer_style, blocked_details")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    const item = data as EswarShareIndex | null;
    if (!item) return null;
    if (item.expires_at && Date.parse(item.expires_at) < Date.now()) return null;
    return item;
  }

  async count(): Promise<number> {
    const { count, error } = await this.supabase.from("eswar_share_index").select("key", { count: "exact", head: true });
    if (error) throw error;
    return count ?? 0;
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GmailDraftRecord } from "../skills/gmail/gmailTypes.js";

export class MailDraftRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(record: GmailDraftRecord): Promise<GmailDraftRecord> {
    const { data, error } = await this.supabase
      .from("gmail_drafts")
      .insert(record)
      .select("*")
      .single();
    if (error) throw error;
    return data as GmailDraftRecord;
  }

  async listRecent(ownerTelegramUserId: string, limit = 10): Promise<GmailDraftRecord[]> {
    const { data, error } = await this.supabase
      .from("gmail_drafts")
      .select("*")
      .eq("owner_telegram_user_id", ownerTelegramUserId)
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(25, limit)));
    if (error) throw error;
    return data as GmailDraftRecord[];
  }

  async findByDraftId(ownerTelegramUserId: string, draftId: string): Promise<GmailDraftRecord | null> {
    const { data, error } = await this.supabase
      .from("gmail_drafts")
      .select("*")
      .eq("owner_telegram_user_id", ownerTelegramUserId)
      .eq("gmail_draft_id", draftId)
      .maybeSingle();
    if (error) throw error;
    return data as GmailDraftRecord | null;
  }

  async markDiscarded(ownerTelegramUserId: string, draftId: string): Promise<void> {
    const { error } = await this.supabase
      .from("gmail_drafts")
      .update({ status: "discarded", updated_at: new Date().toISOString() })
      .eq("owner_telegram_user_id", ownerTelegramUserId)
      .eq("gmail_draft_id", draftId);
    if (error) throw error;
  }

  async markSent(ownerTelegramUserId: string, draftId: string): Promise<void> {
    const { error } = await this.supabase
      .from("gmail_drafts")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .eq("owner_telegram_user_id", ownerTelegramUserId)
      .eq("gmail_draft_id", draftId);
    if (error) throw error;
  }
}

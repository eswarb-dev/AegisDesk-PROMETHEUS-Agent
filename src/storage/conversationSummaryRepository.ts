import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "../memory/memoryTypes.js";

export type ConversationSummaryRow = {
  telegram_user_id: string;
  role: UserRole;
  contact_id?: string | null;
  short_summary: string;
  long_summary?: string | null;
  last_message_at?: string | null;
  message_count?: number;
};

export class ConversationSummaryRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getConversationSummary(telegramUserId: string | number): Promise<ConversationSummaryRow | null> {
    const { data, error } = await this.supabase
      .from("conversation_summaries")
      .select("telegram_user_id, role, contact_id, short_summary, long_summary, last_message_at, message_count")
      .eq("telegram_user_id", String(telegramUserId))
      .maybeSingle();
    if (error) throw error;
    return data as ConversationSummaryRow | null;
  }

  async updateConversationSummary(input: ConversationSummaryRow): Promise<ConversationSummaryRow> {
    const now = new Date().toISOString();
    const existing = await this.getConversationSummary(input.telegram_user_id);
    const { data, error } = await this.supabase
      .from("conversation_summaries")
      .upsert(
        {
          ...input,
          telegram_user_id: String(input.telegram_user_id),
          short_summary: input.short_summary.slice(-1200),
          message_count: (existing?.message_count ?? 0) + 1,
          last_message_at: now,
          updated_at: now
        },
        { onConflict: "telegram_user_id" }
      )
      .select("telegram_user_id, role, contact_id, short_summary, long_summary, last_message_at, message_count")
      .single();
    if (error) throw error;
    return data as ConversationSummaryRow;
  }

  async deleteForUser(telegramUserId: string | number): Promise<void> {
    const { error } = await this.supabase.from("conversation_summaries").delete().eq("telegram_user_id", String(telegramUserId));
    if (error) throw error;
  }
}

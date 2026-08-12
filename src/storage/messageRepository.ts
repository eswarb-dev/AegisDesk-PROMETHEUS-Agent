import type { SupabaseClient } from "@supabase/supabase-js";
import { redactSecrets } from "../utils/redactSecrets.js";

export type BotMessageDirection = "inbound" | "outbound";
export type BotMessageType = "command" | "text" | "system" | "fallback" | "admin";

export type BotMessageRow = {
  id?: string;
  telegram_user_id: string;
  chat_id: string;
  role: string;
  contact_id?: string | null;
  direction: BotMessageDirection;
  message_type: BotMessageType;
  text?: string | null;
  text_redacted?: string | null;
  command?: string | null;
  groq_used?: boolean;
  fallback_used?: boolean;
  created_at?: string;
};

export class MessageRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async storeInboundMessage(input: Omit<BotMessageRow, "direction" | "text_redacted">): Promise<void> {
    await this.insertMessage({ ...input, direction: "inbound" });
  }

  async storeOutboundMessage(input: Omit<BotMessageRow, "direction" | "text_redacted">): Promise<void> {
    await this.insertMessage({ ...input, direction: "outbound" });
  }

  async getRecentMessages(input: { contactId?: string | null; limit?: number } = {}): Promise<BotMessageRow[]> {
    let query = this.supabase
      .from("bot_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(clampLimit(input.limit));
    if (input.contactId) query = query.eq("contact_id", input.contactId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).reverse() as BotMessageRow[];
  }

  async getMessagesByContactId(contactId: string, telegramUserId?: string | number | null, limit = 20): Promise<BotMessageRow[]> {
    let query = this.supabase.from("bot_messages").select("*").order("created_at", { ascending: false }).limit(clampLimit(limit));
    query = telegramUserId ? query.eq("telegram_user_id", String(telegramUserId)) : query.eq("contact_id", contactId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).reverse() as BotMessageRow[];
  }

  async getRecentMessagesByTelegramUserId(telegramUserId: string | number, limit = 20): Promise<BotMessageRow[]> {
    const { data, error } = await this.supabase
      .from("bot_messages")
      .select("*")
      .eq("telegram_user_id", String(telegramUserId))
      .order("created_at", { ascending: false })
      .limit(clampLimit(limit));
    if (error) throw error;
    return (data ?? []).reverse() as BotMessageRow[];
  }

  async searchMessages(input: { contactId: string; query: string; limit?: number }): Promise<BotMessageRow[]> {
    const { data, error } = await this.supabase
      .from("bot_messages")
      .select("*")
      .eq("contact_id", input.contactId)
      .ilike("text_redacted", `%${input.query}%`)
      .order("created_at", { ascending: false })
      .limit(clampLimit(input.limit));
    if (error) throw error;
    return (data ?? []).reverse() as BotMessageRow[];
  }

  async searchMessagesByContactId(input: { contactId: string; telegramUserId?: string | number | null; query: string; limit?: number }): Promise<BotMessageRow[]> {
    let query = this.supabase.from("bot_messages").select("*").order("created_at", { ascending: false }).limit(clampLimit(input.limit));
    query = input.telegramUserId ? query.eq("telegram_user_id", String(input.telegramUserId)) : query.eq("contact_id", input.contactId);
    query = query.or(`text_redacted.ilike.%${input.query}%,text.ilike.%${input.query}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).reverse() as BotMessageRow[];
  }

  async getLatestMessageForContact(contactId: string): Promise<BotMessageRow | null> {
    const { data, error } = await this.supabase
      .from("bot_messages")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as BotMessageRow | null;
  }

  async getMessagesToday(): Promise<BotMessageRow[]> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await this.supabase
      .from("bot_messages")
      .select("*")
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as BotMessageRow[];
  }

  async exportMessages(contactId: string): Promise<BotMessageRow[]> {
    const { data, error } = await this.supabase
      .from("bot_messages")
      .select("*")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as BotMessageRow[];
  }

  async deleteUserMessages(telegramUserId: string | number): Promise<void> {
    const { error } = await this.supabase.from("bot_messages").delete().eq("telegram_user_id", String(telegramUserId));
    if (error) throw error;
  }

  private async insertMessage(input: BotMessageRow): Promise<void> {
    const textRedacted = redactSecrets(input.text);
    const { error } = await this.supabase.from("bot_messages").insert({
      ...input,
      telegram_user_id: String(input.telegram_user_id),
      chat_id: String(input.chat_id),
      text: textRedacted === input.text ? input.text ?? null : null,
      text_redacted: textRedacted,
      command: input.command ?? null
    });
    if (error) throw error;
  }
}

function clampLimit(limit = 20): number {
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TelegramUserRow } from "./userRepository.js";

export type AdminAuditRow = {
  actor_telegram_user_id: string;
  action: string;
  target_table?: string | null;
  target_user_id?: string | null;
  target_contact_id?: string | null;
  safe_description?: string | null;
  created_at?: string;
};

export class AdminRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getUsers(): Promise<TelegramUserRow[]> {
    const { data, error } = await this.supabase
      .from("telegram_users")
      .select("id, telegram_user_id, chat_id, username, display_name, role, contact_id, memory_enabled, approved, created_at, updated_at, last_seen_at")
      .order("last_seen_at", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as TelegramUserRow[];
  }

  async getContacts(): Promise<TelegramUserRow[]> {
    const { data, error } = await this.supabase
      .from("telegram_users")
      .select("telegram_user_id, chat_id, username, display_name, role, contact_id, memory_enabled, approved, last_seen_at")
      .in("role", ["trusted_contact", "pending"])
      .order("contact_id");
    if (error) throw error;
    return (data ?? []) as TelegramUserRow[];
  }

  async getPendingUsers(): Promise<TelegramUserRow[]> {
    const { data, error } = await this.supabase
      .from("telegram_users")
      .select("telegram_user_id, chat_id, username, display_name, role, contact_id, memory_enabled, approved, last_seen_at")
      .eq("role", "pending");
    if (error) throw error;
    return (data ?? []) as TelegramUserRow[];
  }

  async getAuditLogs(limit = 20): Promise<AdminAuditRow[]> {
    const { data, error } = await this.supabase
      .from("memory_audit_logs")
      .select("actor_telegram_user_id, action, target_user_id, target_contact_id, safe_description, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(100, limit)));
    if (error) throw error;
    return (data ?? []) as AdminAuditRow[];
  }

  async writeAuditLog(input: AdminAuditRow): Promise<void> {
    const { error } = await this.supabase.from("memory_audit_logs").insert({
      target_table: input.target_table ?? "admin",
      ...input
    });
    if (error) throw error;
  }
}

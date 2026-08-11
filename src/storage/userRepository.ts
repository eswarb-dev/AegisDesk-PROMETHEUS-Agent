import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "../memory/memoryTypes.js";

export type TelegramUserRow = {
  telegram_user_id: string;
  chat_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  role: UserRole;
  contact_id?: string | null;
  memory_enabled?: boolean;
  approved?: boolean;
  last_seen_at?: string | null;
};

export class UserRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createOrUpdateTelegramUser(user: TelegramUserRow): Promise<TelegramUserRow> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("telegram_users")
      .upsert(
        {
          ...user,
          telegram_user_id: String(user.telegram_user_id),
          chat_id: user.chat_id == null ? null : String(user.chat_id),
          updated_at: now,
          last_seen_at: user.last_seen_at ?? now
        },
        { onConflict: "telegram_user_id" }
      )
      .select("telegram_user_id, chat_id, username, display_name, role, contact_id, memory_enabled, approved, last_seen_at")
      .single();
    if (error) throw error;
    return data as TelegramUserRow;
  }

  async getTelegramUserById(telegramUserId: string | number): Promise<TelegramUserRow | null> {
    const { data, error } = await this.supabase
      .from("telegram_users")
      .select("telegram_user_id, chat_id, username, display_name, role, contact_id, memory_enabled, approved, last_seen_at")
      .eq("telegram_user_id", String(telegramUserId))
      .maybeSingle();
    if (error) throw error;
    return data as TelegramUserRow | null;
  }

  async updateLastSeen(telegramUserId: string | number): Promise<void> {
    const { error } = await this.supabase
      .from("telegram_users")
      .update({ last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("telegram_user_id", String(telegramUserId));
    if (error) throw error;
  }

  async countByRole(role?: UserRole): Promise<number> {
    let query = this.supabase.from("telegram_users").select("telegram_user_id", { count: "exact", head: true });
    if (role) query = query.eq("role", role);
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }
}

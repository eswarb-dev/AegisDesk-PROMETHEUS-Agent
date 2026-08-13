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
  created_at?: string | null;
  updated_at?: string | null;
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

  async getTelegramUserByContactId(contactId: string): Promise<TelegramUserRow | null> {
    const { data, error } = await this.supabase
      .from("telegram_users")
      .select("telegram_user_id, chat_id, username, display_name, role, contact_id, memory_enabled, approved, last_seen_at")
      .eq("contact_id", contactId)
      .eq("role", "trusted_contact")
      .maybeSingle();
    if (error) throw error;
    return data as TelegramUserRow | null;
  }

  async getAnyTelegramUserById(telegramUserId: string | number): Promise<TelegramUserRow | null> {
    return this.getTelegramUserById(telegramUserId);
  }

  async listBroadcastRecipients(): Promise<Array<Pick<TelegramUserRow, "telegram_user_id" | "chat_id" | "role" | "contact_id">>> {
    const { data, error } = await this.supabase
      .from("telegram_users")
      .select("telegram_user_id, chat_id, role, contact_id")
      .not("chat_id", "is", null)
      .order("last_seen_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<Pick<TelegramUserRow, "telegram_user_id" | "chat_id" | "role" | "contact_id">>;
  }

  async repairOwnerIdentity(input: {
    telegramUserId: string;
    chatId?: string | null;
    username?: string | null;
    displayName?: string | null;
  }): Promise<void> {
    const now = new Date().toISOString();
    await this.supabase
      .from("telegram_users")
      .upsert(
        {
          telegram_user_id: input.telegramUserId,
          chat_id: input.chatId ?? input.telegramUserId,
          username: input.username ?? null,
          display_name: input.displayName ?? "Eswar B",
          role: "owner",
          contact_id: null,
          approved: true,
          memory_enabled: true,
          updated_at: now,
          last_seen_at: now
        },
        { onConflict: "telegram_user_id" }
      )
      .throwOnError();
    await this.supabase
      .from("telegram_users")
      .update({ role: "user", contact_id: null, approved: false, updated_at: now })
      .eq("role", "owner")
      .neq("telegram_user_id", input.telegramUserId)
      .throwOnError();
    await this.supabase
      .from("trusted_contacts")
      .update({ telegram_user_id: null, chat_id: null, approved: false, updated_at: now })
      .eq("telegram_user_id", input.telegramUserId)
      .throwOnError();
    if (process.env.DEBUG_OWNER_IDENTITY === "1") {
      console.info(JSON.stringify({ level: "info", message: "owner_role_repaired" }));
    }
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

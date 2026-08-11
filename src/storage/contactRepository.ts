import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContactId, TrustedContact, TrustedContactsData } from "../contacts/trustedContactTypes.js";

function toTrustedContact(row: Record<string, unknown>): TrustedContact {
  return {
    id: row.contact_id as ContactId,
    name: (row.display_name as string | null) ?? (row.contact_id as string),
    telegram_user_id: row.telegram_user_id ? Number(row.telegram_user_id) : null,
    chat_id: row.chat_id ? Number(row.chat_id) : null,
    username: (row.username as string | null) ?? null,
    enabled: Boolean(row.approved),
    role: "trusted_contact",
    permissions: {
      receive_agent_messages: Boolean(row.notification_enabled),
      receive_wellbeing_updates: Boolean(row.notification_enabled),
      ask_about_eswar: true,
      access_trusted_memory: true,
      access_owner_memory: false
    },
    created_at: (row.created_at as string | null) ?? null,
    approved_at: (row.approved ? row.updated_at : null) as string | null,
    last_seen: (row.last_seen_at as string | null) ?? null
  };
}

export class ContactRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(): Promise<TrustedContactsData> {
    const { data: contacts, error } = await this.supabase.from("trusted_contacts").select("*").order("contact_id");
    if (error) throw error;
    const { data: pending, error: pendingError } = await this.supabase
      .from("telegram_users")
      .select("telegram_user_id, chat_id, username, display_name, role, created_at, last_seen_at")
      .eq("role", "pending");
    if (pendingError) throw pendingError;
    return {
      trusted_contacts: (contacts ?? []).map((row) => toTrustedContact(row)),
      pending_users: (pending ?? []).map((row) => ({
        telegram_user_id: Number(row.telegram_user_id),
        chat_id: Number(row.chat_id ?? row.telegram_user_id),
        username: row.username ?? undefined,
        display_name: row.display_name ?? "Telegram user",
        role: "pending",
        trusted: false,
        created_at: row.created_at,
        last_seen: row.last_seen_at ?? row.created_at
      }))
    };
  }

  async findEnabledByTelegramId(telegramUserId: string | number): Promise<TrustedContact | undefined> {
    const { data, error } = await this.supabase
      .from("trusted_contacts")
      .select("*")
      .eq("telegram_user_id", String(telegramUserId))
      .eq("approved", true)
      .maybeSingle();
    if (error) throw error;
    return data ? toTrustedContact(data) : undefined;
  }

  async approve(telegramUserId: string | number, contactId: ContactId): Promise<TrustedContact> {
    const { data: user, error: userError } = await this.supabase
      .from("telegram_users")
      .select("telegram_user_id, chat_id, username, display_name")
      .eq("telegram_user_id", String(telegramUserId))
      .maybeSingle();
    if (userError) throw userError;
    if (!user) throw new Error("Telegram ID is not registered as pending. Ask them to run /start first.");

    const { data, error } = await this.supabase
      .from("trusted_contacts")
      .update({
        telegram_user_id: String(telegramUserId),
        chat_id: user.chat_id,
        username: user.username,
        display_name: contactId,
        approved: true,
        notification_enabled: true,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString()
      })
      .eq("contact_id", contactId)
      .select("*")
      .single();
    if (error) throw error;

    const { error: roleError } = await this.supabase
      .from("telegram_users")
      .update({ role: "trusted_contact", contact_id: contactId, approved: true, updated_at: new Date().toISOString() })
      .eq("telegram_user_id", String(telegramUserId));
    if (roleError) throw roleError;
    return toTrustedContact(data);
  }

  async revoke(contactId: ContactId): Promise<TrustedContact> {
    const { data: before } = await this.supabase.from("trusted_contacts").select("*").eq("contact_id", contactId).maybeSingle();
    const { data, error } = await this.supabase
      .from("trusted_contacts")
      .update({
        telegram_user_id: null,
        chat_id: null,
        approved: false,
        notification_enabled: false,
        updated_at: new Date().toISOString()
      })
      .eq("contact_id", contactId)
      .select("*")
      .single();
    if (error) throw error;
    if (before?.telegram_user_id) {
      const { error: roleError } = await this.supabase
        .from("telegram_users")
        .update({ role: "user", contact_id: null, approved: false, updated_at: new Date().toISOString() })
        .eq("telegram_user_id", before.telegram_user_id);
      if (roleError) throw roleError;
    }
    return toTrustedContact(data);
  }

  async countApproved(): Promise<number> {
    const { count, error } = await this.supabase.from("trusted_contacts").select("contact_id", { count: "exact", head: true }).eq("approved", true);
    if (error) throw error;
    return count ?? 0;
  }
}

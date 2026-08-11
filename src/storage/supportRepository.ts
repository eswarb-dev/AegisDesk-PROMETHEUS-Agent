import type { SupabaseClient } from "@supabase/supabase-js";
import type { DistressSeverity, EmotionalState } from "../support/emotionalStateDetector.js";

export type TrustedSupportEventRow = {
  id?: string;
  contact_id: string;
  telegram_user_id: string;
  chat_id: string;
  emotional_state: EmotionalState;
  severity: DistressSeverity;
  safe_summary: string;
  safe_quote?: string | null;
  owner_notified?: boolean;
  owner_notified_at?: string | null;
  created_at?: string;
};

export type OwnerAlertRow = {
  id?: string;
  alert_type: string;
  contact_id?: string | null;
  telegram_user_id?: string | null;
  severity: DistressSeverity;
  title: string;
  body: string;
  delivered?: boolean;
  delivered_at?: string | null;
  created_at?: string;
};

export class SupportRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createSupportEvent(input: TrustedSupportEventRow): Promise<TrustedSupportEventRow> {
    const { data, error } = await this.supabase.from("trusted_support_events").insert(input).select("*").single();
    if (error) throw error;
    return data as TrustedSupportEventRow;
  }

  async getRecentSupportEvents(contactId?: string | null, limit = 20): Promise<TrustedSupportEventRow[]> {
    let query = this.supabase.from("trusted_support_events").select("*").order("created_at", { ascending: false }).limit(Math.max(1, Math.min(100, limit)));
    if (contactId) query = query.eq("contact_id", contactId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as TrustedSupportEventRow[];
  }

  async getRecentEventsForContact(contactId: string, limit = 5): Promise<TrustedSupportEventRow[]> {
    return this.getRecentSupportEvents(contactId, limit);
  }

  async getLastOwnerAlert(contactId: string, severity?: DistressSeverity): Promise<OwnerAlertRow | null> {
    let query = this.supabase.from("owner_alerts").select("*").eq("contact_id", contactId).order("created_at", { ascending: false }).limit(1);
    if (severity) query = query.eq("severity", severity);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data as OwnerAlertRow | null;
  }

  async createOwnerAlert(input: OwnerAlertRow): Promise<OwnerAlertRow> {
    const { data, error } = await this.supabase.from("owner_alerts").insert(input).select("*").single();
    if (error) throw error;
    return data as OwnerAlertRow;
  }

  async markOwnerAlertDelivered(id: string): Promise<void> {
    const { error } = await this.supabase.from("owner_alerts").update({ delivered: true, delivered_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  }

  async getOwnerAlerts(limit = 20): Promise<OwnerAlertRow[]> {
    const { data, error } = await this.supabase.from("owner_alerts").select("*").order("created_at", { ascending: false }).limit(Math.max(1, Math.min(100, limit)));
    if (error) throw error;
    return (data ?? []) as OwnerAlertRow[];
  }
}

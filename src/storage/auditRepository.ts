import type { SupabaseClient } from "@supabase/supabase-js";

export class AuditRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async writeAuditLog(input: {
    actor_telegram_user_id?: string | null;
    action: string;
    target_table: string;
    target_id?: string | null;
    safe_description?: string | null;
  }): Promise<void> {
    const { error } = await this.supabase.from("memory_audit_logs").insert(input);
    if (error) throw error;
  }
}

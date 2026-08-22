import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "../memory/memoryTypes.js";
import type { UserStyleProfile } from "../prometheus/core/userStyleLearner.js";
import { mergeUnique } from "../prometheus/core/userStyleLearner.js";

export type LearningEventRow = {
  id: string;
  telegram_user_id: string;
  event_type: string;
  observation: string;
  memory_update?: Record<string, unknown> | null;
  confidence: number;
  applied: boolean;
  created_at?: string | null;
};

export class StyleRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getProfile(telegramUserId: string | number): Promise<UserStyleProfile | null> {
    const { data, error } = await this.supabase
      .from("user_style_profiles")
      .select("*")
      .eq("telegram_user_id", String(telegramUserId))
      .maybeSingle();
    if (error) throw error;
    return data as UserStyleProfile | null;
  }

  async upsertProfile(input: Partial<UserStyleProfile> & { telegram_user_id: string | number; role: UserRole; contact_id?: string | null }): Promise<UserStyleProfile> {
    const existing = await this.getProfile(input.telegram_user_id).catch(() => null);
    const next = {
      telegram_user_id: String(input.telegram_user_id),
      role: input.role,
      contact_id: input.contact_id ?? existing?.contact_id ?? null,
      address_preference: input.role === "owner" ? "Sir" : input.address_preference ?? existing?.address_preference ?? null,
      slang_terms: mergeUnique(existing?.slang_terms, input.slang_terms),
      emoji_preference: input.emoji_preference ?? existing?.emoji_preference ?? "natural",
      preferred_reply_length: input.preferred_reply_length ?? existing?.preferred_reply_length ?? "short",
      preferred_tone: input.preferred_tone ?? existing?.preferred_tone ?? "warm_direct",
      emotional_support_style: input.emotional_support_style ?? existing?.emotional_support_style ?? null,
      dislikes: mergeUnique(existing?.dislikes, input.dislikes),
      repeated_topics: mergeUnique(existing?.repeated_topics, input.repeated_topics),
      confidence: Math.max(existing?.confidence ?? 0.5, input.confidence ?? 0.5),
      learning_enabled: input.learning_enabled ?? existing?.learning_enabled ?? true,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await this.supabase
      .from("user_style_profiles")
      .upsert(next, { onConflict: "telegram_user_id" })
      .select("*")
      .single();
    if (error) throw error;
    return data as UserStyleProfile;
  }

  async deleteProfile(telegramUserId: string | number): Promise<void> {
    const { error } = await this.supabase.from("user_style_profiles").delete().eq("telegram_user_id", String(telegramUserId));
    if (error) throw error;
  }

  async setLearningEnabled(telegramUserId: string | number, enabled: boolean, role: UserRole, contactId?: string | null): Promise<void> {
    await this.upsertProfile({ telegram_user_id: String(telegramUserId), role, contact_id: contactId ?? null, learning_enabled: enabled });
  }

  async createLearningEvent(input: Omit<LearningEventRow, "id" | "applied" | "created_at"> & { applied?: boolean }): Promise<LearningEventRow> {
    const { data, error } = await this.supabase
      .from("learning_events")
      .insert({
        telegram_user_id: String(input.telegram_user_id),
        event_type: input.event_type,
        observation: input.observation,
        memory_update: input.memory_update ?? null,
        confidence: input.confidence,
        applied: input.applied ?? false
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as LearningEventRow;
  }

  async listLearningEvents(limit = 10): Promise<LearningEventRow[]> {
    const { data, error } = await this.supabase
      .from("learning_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as LearningEventRow[];
  }

  async markLearningEvent(id: string, applied: boolean): Promise<void> {
    const { error } = await this.supabase.from("learning_events").update({ applied }).eq("id", id);
    if (error) throw error;
  }
}

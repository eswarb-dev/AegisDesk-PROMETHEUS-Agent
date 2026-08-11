import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";

export type SupabaseConfig = Pick<AppConfig, "supabaseUrl" | "supabaseServiceRoleKey" | "nodeEnv">;

let cachedClient: SupabaseClient | undefined;

export function createSupabaseServerClient(config: SupabaseConfig): SupabaseClient {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    if (config.nodeEnv === "production") {
      throw new Error("Supabase configuration is required in production.");
    }
    throw new Error("Supabase configuration is missing.");
  }
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function getSupabaseServerClient(config: SupabaseConfig): SupabaseClient {
  cachedClient ??= createSupabaseServerClient(config);
  return cachedClient;
}

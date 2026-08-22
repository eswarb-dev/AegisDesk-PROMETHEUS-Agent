import type { UserRole } from "../../memory/memoryTypes.js";

export type UserStyleProfile = {
  telegram_user_id: string;
  role: UserRole;
  contact_id?: string | null;
  address_preference?: string | null;
  slang_terms: string[];
  emoji_preference: "minimal" | "natural" | "expressive";
  preferred_reply_length: "short" | "medium" | "detailed";
  preferred_tone: "warm_direct" | "casual_warm" | "gentle" | "direct";
  emotional_support_style?: string | null;
  dislikes: string[];
  repeated_topics: string[];
  confidence: number;
  learning_enabled?: boolean;
};

export function mergeUnique(existing: string[] = [], incoming: string[] = []): string[] {
  return Array.from(new Set([...existing, ...incoming].filter(Boolean))).slice(0, 24);
}

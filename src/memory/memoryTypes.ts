export type MemoryItemType = "preference" | "project" | "person" | "event" | "instruction" | "style" | "state";
export type MemoryVisibility = "owner_only" | "trusted_contacts" | "public" | "self_only";
export type UserRole = "owner" | "trusted_contact" | "user" | "pending";
export type TelegramUserRole = UserRole;

export type MemoryItem = {
  id: string;
  type: MemoryItemType;
  content: string;
  source: "manual" | "conversation";
  confidence: number;
  visibility: MemoryVisibility;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
};

export type PersistentMemoryItem = {
  id: string;
  owner_user_id: string;
  type: "preference" | "conversation_summary" | "relationship" | "project" | "state" | "instruction";
  content: string;
  visibility: MemoryVisibility;
  allowed_contacts: string[];
  subject_contact_id?: string | null;
  usable_when_chatting_with_subject?: boolean;
  disclosable_to_subject?: boolean;
  source: "manual" | "conversation_summary" | "owner_approved";
  confidence: number;
  sensitivity: "low" | "medium" | "high";
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  review_required: boolean;
};

export type EswarMemory = {
  owner: {
    name: string;
    preferred_name: string;
    role: "owner";
  };
  personality_preferences: Record<string, string>;
  identity: Record<string, string>;
  projects: MemoryItem[];
  people: MemoryItem[];
  preferences: MemoryItem[];
  important_memories: MemoryItem[];
  do_not_claim: string[];
  sharing_policy?: {
    core_principle: string;
    trusted_contact_note: string;
    approved_public_facts: string[];
  };
};

export type StoredTelegramUser = {
  telegram_user_id: number;
  chat_id: number;
  username?: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  trusted?: boolean;
  created_at: string;
  last_seen: string;
};

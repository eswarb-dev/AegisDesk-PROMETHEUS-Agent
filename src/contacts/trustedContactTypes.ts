import type { StoredTelegramUser, UserRole } from "../memory/memoryTypes.js";

export type ContactId = "aksharaa" | "vathanya" | "maddhurika";

export type TrustedContactPermissions = {
  receive_agent_messages: boolean;
  receive_wellbeing_updates: boolean;
  ask_about_eswar: boolean;
  access_trusted_memory: boolean;
  access_owner_memory: false;
};

export type TrustedContact = {
  id: ContactId;
  name: string;
  telegram_user_id: number | null;
  chat_id: number | null;
  username: string | null;
  enabled: boolean;
  role: "trusted_contact";
  permissions: TrustedContactPermissions;
  created_at: string | null;
  approved_at: string | null;
  last_seen: string | null;
};

export type PendingTelegramUser = StoredTelegramUser & {
  role: "pending";
  trusted: false;
};

export type TrustedContactsData = {
  trusted_contacts: TrustedContact[];
  pending_users: PendingTelegramUser[];
};

export type ResolvedTelegramIdentity = {
  role: UserRole;
  contact?: TrustedContact;
};

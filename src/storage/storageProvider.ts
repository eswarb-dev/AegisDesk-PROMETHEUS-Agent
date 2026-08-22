import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import { trustedContactStore } from "../contacts/trustedContactStore.js";
import { memoryStore } from "../memory/memoryStore.js";
import { shareIndexStore } from "../memory/shareIndexStore.js";
import { userMemoryStore } from "../memory/userMemoryStore.js";
import { AuditRepository } from "./auditRepository.js";
import { AdminRepository } from "./adminRepository.js";
import { ContactRepository } from "./contactRepository.js";
import { ConversationSummaryRepository } from "./conversationSummaryRepository.js";
import { MemoryRepository } from "./memoryRepository.js";
import { MailDraftRepository } from "./mailDraftRepository.js";
import { MessageRepository } from "./messageRepository.js";
import { ShareIndexRepository } from "./shareIndexRepository.js";
import { getSupabaseServerClient } from "./supabaseClient.js";
import { SupportRepository } from "./supportRepository.js";
import { UserRepository } from "./userRepository.js";
import { StyleRepository } from "./styleRepository.js";

export type JsonStorageProvider = {
  kind: "json";
  memoryStore: typeof memoryStore;
  trustedContactStore: typeof trustedContactStore;
  userMemoryStore: typeof userMemoryStore;
  shareIndexStore: typeof shareIndexStore;
};

export type SupabaseStorageProvider = {
  kind: "supabase";
  supabase: SupabaseClient;
  users: UserRepository;
  memories: MemoryRepository;
  contacts: ContactRepository;
  shareIndexes: ShareIndexRepository;
  conversations: ConversationSummaryRepository;
  audit: AuditRepository;
  admin: AdminRepository;
  messages: MessageRepository;
  support: SupportRepository;
  mailDrafts: MailDraftRepository;
  styles: StyleRepository;
};

export type StorageProvider = JsonStorageProvider | SupabaseStorageProvider;

export function createStorageProvider(config: AppConfig): StorageProvider {
  if (config.databaseProvider !== "supabase") {
    return {
      kind: "json",
      memoryStore,
      trustedContactStore,
      userMemoryStore,
      shareIndexStore
    };
  }

  const supabase = getSupabaseServerClient(config);
  return {
    kind: "supabase",
    supabase,
    users: new UserRepository(supabase),
    memories: new MemoryRepository(supabase),
    contacts: new ContactRepository(supabase),
    shareIndexes: new ShareIndexRepository(supabase),
    conversations: new ConversationSummaryRepository(supabase),
    audit: new AuditRepository(supabase),
    admin: new AdminRepository(supabase),
    messages: new MessageRepository(supabase),
    support: new SupportRepository(supabase),
    mailDrafts: new MailDraftRepository(supabase),
    styles: new StyleRepository(supabase)
  };
}

export async function getStorageSummary(provider: StorageProvider): Promise<{
  storage: "json" | "supabase";
  ownerMemories: number;
  userMemories: number;
  trustedContacts: number;
  shareIndexes: number;
}> {
  if (provider.kind === "json") {
    const memory = await provider.memoryStore.loadMemory();
    const users = (await provider.userMemoryStore.load()).users;
    const contacts = (await provider.trustedContactStore.load()).trusted_contacts.filter((contact) => contact.enabled);
    const indexes = (await provider.shareIndexStore.load()).indexes;
    return {
      storage: "json",
      ownerMemories: memory.projects.length + memory.people.length + memory.preferences.length + memory.important_memories.length,
      userMemories: users.length,
      trustedContacts: contacts.length,
      shareIndexes: indexes.length
    };
  }

  return {
    storage: "supabase",
    ownerMemories: await provider.memories.count(),
    userMemories: await provider.users.countByRole(),
    trustedContacts: await provider.contacts.countApproved(),
    shareIndexes: await provider.shareIndexes.count()
  };
}

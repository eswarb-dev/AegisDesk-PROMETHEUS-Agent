import type { TrustedContactsData } from "../contacts/trustedContactTypes.js";
import type { EswarMemory } from "../memory/memoryTypes.js";
import type { ShareIndexData } from "../memory/shareIndexStore.js";
import type { UserMemoriesData } from "../memory/userMemoryStore.js";

export const defaultTrustedContactsData: TrustedContactsData = {
  trusted_contacts: [
    {
      id: "aksharaa",
      name: "Aksharaa",
      telegram_user_id: null,
      chat_id: null,
      username: null,
      enabled: false,
      role: "trusted_contact",
      permissions: {
        receive_agent_messages: true,
        receive_wellbeing_updates: true,
        ask_about_eswar: true,
        access_trusted_memory: true,
        access_owner_memory: false
      },
      created_at: null,
      approved_at: null,
      last_seen: null
    },
    {
      id: "vathanya",
      name: "Vathanya",
      telegram_user_id: null,
      chat_id: null,
      username: null,
      enabled: false,
      role: "trusted_contact",
      permissions: {
        receive_agent_messages: true,
        receive_wellbeing_updates: true,
        ask_about_eswar: true,
        access_trusted_memory: true,
        access_owner_memory: false
      },
      created_at: null,
      approved_at: null,
      last_seen: null
    },
    {
      id: "maddhurika",
      name: "Maddhurika",
      telegram_user_id: null,
      chat_id: null,
      username: null,
      enabled: false,
      role: "trusted_contact",
      permissions: {
        receive_agent_messages: true,
        receive_wellbeing_updates: true,
        ask_about_eswar: true,
        access_trusted_memory: true,
        access_owner_memory: false
      },
      created_at: null,
      approved_at: null,
      last_seen: null
    }
  ],
  pending_users: []
};

export const defaultEswarMemoryData: EswarMemory = {
  owner: {
    name: "Eswar B",
    preferred_name: "Eswar",
    role: "owner"
  },
  personality_preferences: {
    tone: "friendly, direct, loyal, context-aware",
    emoji_usage: "natural and based on context",
    response_length: "short by default, detailed when asked",
    style: "human-like but honest as an agent"
  },
  identity: {
    bot_name: "PROMETHEUS",
    system_name: "AEGISDESK // AGENT SYSTEM",
    relationship: "Personalised Agent to Eswar B",
    telegram_role: "conversational interface for PROMETHEUS"
  },
  projects: [],
  people: [],
  preferences: [],
  important_memories: [],
  do_not_claim: [
    "Do not claim to control devices from Telegram.",
    "Do not claim to know something unless it is in memory.",
    "Do not expose private memory to other users.",
    "Do not treat trusted contacts as owners."
  ],
  sharing_policy: {
    core_principle: "PROMETHEUS may know a lot about Eswar internally, but knowing information does not automatically mean it is allowed to share that information.",
    trusted_contact_note: "Trusted contacts may receive explicitly approved messages only. Trusted status must not grant private memory access.",
    approved_public_facts: [
      "PROMETHEUS is Eswar B's personalised agent under AegisDesk.",
      "This Telegram bot is a conversational interface for PROMETHEUS.",
      "No laptop or device control is enabled in this Telegram bot."
    ]
  }
};

export const defaultUserMemoriesData: UserMemoriesData = {
  users: []
};

export const defaultConversationSummariesData = {
  summaries: []
};

export const defaultShareIndexData: ShareIndexData = {
  indexes: [
    {
      key: "eswar_general_personality",
      summary: "Eswar is practical, observant, emotionally aware, and prefers direct but friendly conversations.",
      visibility: "trusted_contacts",
      allowed_contacts: ["aksharaa", "vathanya", "maddhurika"],
      sensitivity: "low",
      source: "owner_approved",
      confidence: 1,
      expires_at: null,
      safe_answer_style: "warm and general",
      blocked_details: ["private conversations", "specific emotional disclosures", "unapproved personal events"]
    },
    {
      key: "eswar_communication_style",
      summary: "Eswar usually appreciates calm, direct, honest communication without unnecessary drama.",
      visibility: "trusted_contacts",
      allowed_contacts: ["aksharaa", "vathanya", "maddhurika"],
      sensitivity: "low",
      source: "owner_approved",
      confidence: 1,
      expires_at: null,
      safe_answer_style: "practical and friendly",
      blocked_details: ["private messages", "exact conversations"]
    },
    {
      key: "eswar_support_preference",
      summary: "A simple, normal check-in and honest conversation usually works better with Eswar than pressure or overexplaining.",
      visibility: "trusted_contacts",
      allowed_contacts: ["aksharaa", "vathanya", "maddhurika"],
      sensitivity: "low",
      source: "owner_approved",
      confidence: 1,
      expires_at: null,
      safe_answer_style: "light and supportive",
      blocked_details: ["private emotional analysis", "unapproved personal incidents"]
    }
  ]
};

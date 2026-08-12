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
      enabled: true,
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
      relationship: "sister-like close friend",
      telegram_user_id: null,
      chat_id: null,
      username: null,
      enabled: true,
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
    telegram_role: "conversational interface for PROMETHEUS",
    official_email: "prometheus.inference@gmail.com"
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

export const defaultEswarShareIndexes = [
  {
    key: "eswar_creator_identity",
    summary: "Eswar B is the creator and owner of PROMETHEUS. PROMETHEUS exists under AegisDesk as a personalised agent built to support Eswar, remember safe context, and help trusted contacts communicate with him.",
    visibility: "trusted_contacts",
    allowed_contacts: [],
    sensitivity: "low",
    source: "owner_approved",
    confidence: 1,
    expires_at: null,
    safe_answer_style: "direct and warm",
    blocked_details: ["owner-only memory", "raw owner conversations", "private implementation details"]
  },
  {
    key: "prometheus_role_for_eswar",
    summary: "PROMETHEUS assists Eswar by helping with memory, projects, thinking support, trusted-contact communication, emotional support routing, and safe owner-scoped conversation continuity.",
    visibility: "trusted_contacts",
    allowed_contacts: [],
    sensitivity: "low",
    source: "owner_approved",
    confidence: 1,
    expires_at: null,
    safe_answer_style: "clear and grounded",
    blocked_details: ["owner-only memory", "admin logs", "private owner notes"]
  },
  {
    key: "eswar_trusted_contact_bridge",
    summary: "For trusted contacts, PROMETHEUS can act as a safe emotional bridge to Eswar. It may gently suggest contacting Eswar when someone feels low because Eswar would listen and try to support them.",
    visibility: "trusted_contacts",
    allowed_contacts: [],
    sensitivity: "medium",
    source: "owner_approved",
    confidence: 1,
    expires_at: null,
    safe_answer_style: "supportive and privacy-safe",
    blocked_details: ["private emotional analysis", "raw chats", "owner-only feelings"]
  },
  {
    key: "eswar_general_profile",
    summary: "Eswar B is the creator/owner of PROMETHEUS and AegisDesk. He is practical, observant, emotionally aware, and often acts as a problem solver and supporter for people around him.",
    visibility: "trusted_contacts",
    allowed_contacts: [],
    sensitivity: "low",
    source: "owner_approved",
    confidence: 1,
    expires_at: null,
    safe_answer_style: "warm, natural, and general",
    blocked_details: ["owner-only memory", "raw owner conversations", "private emotional details"]
  },
  {
    key: "eswar_project_focus",
    summary: "Eswar is building AegisDesk, a secure personal agent ecosystem powered by P.R.O.M.E.T.H.E.U.S. It focuses on personal automation, device awareness, trusted-contact support, and owner-scoped memory.",
    visibility: "trusted_contacts",
    allowed_contacts: [],
    sensitivity: "low",
    source: "owner_approved",
    confidence: 1,
    expires_at: null,
    safe_answer_style: "clear and project-aware",
    blocked_details: ["private project secrets", "admin logs", "raw memory JSON"]
  },
  {
    key: "eswar_support_style",
    summary: "Eswar prefers honest, direct, calm communication. If someone feels low, they do not need perfect words to reach him. A small message is enough.",
    visibility: "trusted_contacts",
    allowed_contacts: [],
    sensitivity: "medium",
    source: "owner_approved",
    confidence: 1,
    expires_at: null,
    safe_answer_style: "quietly supportive",
    blocked_details: ["private conversations", "unapproved personal incidents"]
  },
  {
    key: "eswar_emotional_bridge",
    summary: "Eswar would listen if someone reached out. If a trusted contact feels alone or not okay, PROMETHEUS may gently suggest contacting Eswar because he would try to understand and support them.",
    visibility: "trusted_contacts",
    allowed_contacts: [],
    sensitivity: "medium",
    source: "owner_approved",
    confidence: 1,
    expires_at: null,
    safe_answer_style: "warm and emotionally aware",
    blocked_details: ["private emotional analysis", "owner-only feelings", "raw chats"]
  },
  {
    key: "eswar_boundaries",
    summary: "PROMETHEUS can share general, owner-approved information about Eswar, but not private memories, raw conversations, or sensitive owner-only details.",
    visibility: "public",
    allowed_contacts: [],
    sensitivity: "low",
    source: "owner_approved",
    confidence: 1,
    expires_at: null,
    safe_answer_style: "clear and privacy-forward",
    blocked_details: ["owner-only memory", "raw conversations", "private notes", "admin logs"]
  }
] satisfies ShareIndexData["indexes"];

export const defaultShareIndexData: ShareIndexData = {
  indexes: defaultEswarShareIndexes
};

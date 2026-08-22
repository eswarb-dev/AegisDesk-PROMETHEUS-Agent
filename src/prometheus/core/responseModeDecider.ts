import type { UserRole } from "../../memory/memoryTypes.js";
import { detectEmotion } from "./emotionDetector.js";
import { detectIntent } from "./intentDetector.js";

export type CoreResponseMode =
  | "DETERMINISTIC_COMMAND"
  | "CORE_MEMORY_REPLY"
  | "EMOTIONAL_SUPPORT_REPLY"
  | "TRUSTED_CONTACT_REPLY"
  | "GROQ_ASSISTED_REPLY"
  | "BASIC_FALLBACK_REPLY";

export function decideCoreResponseMode(text: string, role: UserRole | "owner"): CoreResponseMode {
  const intent = detectIntent(text);
  if (intent === "command") return "DETERMINISTIC_COMMAND";
  if (intent === "greeting" || intent === "identity" || intent === "owner_memory") return "CORE_MEMORY_REPLY";
  if (detectEmotion(text).needsSupport) return "EMOTIONAL_SUPPORT_REPLY";
  if (role === "trusted_contact" && intent === "trusted_eswar_question") return "TRUSTED_CONTACT_REPLY";
  if (intent === "drafting" || intent === "complex_reasoning") return "GROQ_ASSISTED_REPLY";
  return "GROQ_ASSISTED_REPLY";
}

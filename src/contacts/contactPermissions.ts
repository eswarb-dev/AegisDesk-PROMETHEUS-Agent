import type { TrustedContact } from "./trustedContactTypes.js";

export function canSendAgentMessage(contact: TrustedContact): boolean {
  return contact.enabled && contact.chat_id != null && contact.permissions.receive_agent_messages;
}

export function canSendWellbeingUpdate(contact: TrustedContact): boolean {
  return canSendAgentMessage(contact) && contact.permissions.receive_wellbeing_updates;
}

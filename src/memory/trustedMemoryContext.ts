import type { EswarMemory, UserRole } from "./memoryTypes.js";
import { filterMemoryForRole } from "./memoryAccess.js";

export function buildAllowedMemoryContext(memory: EswarMemory, role: UserRole): string {
  const items = filterMemoryForRole(memory, role);
  const lines = items.slice(0, 12).map((item) => `- ${item.type}: ${item.content}`);

  return [
    `Role: ${role}`,
    role === "owner" || role === "trusted_contact" ? `Owner name: ${memory.owner.name}` : "Owner profile: restricted",
    role === "owner" ? `Preferred name: ${memory.owner.preferred_name}` : undefined,
    role === "owner" ? "Preferred tone: friendly, direct, loyal, lightly playful" : undefined,
    role === "owner" ? `Bot identity: ${memory.identity.bot_name}` : undefined,
    role === "owner" ? `System: ${memory.identity.system_name}` : undefined,
    role === "owner" ? `Relationship: ${memory.identity.relationship}` : undefined,
    `Allowed memory items: ${items.length}`,
    ...lines,
    "Never expose raw memory IDs, JSON structures, or memories outside this filtered context."
  ].filter(Boolean).join("\n");
}

import type { EswarMemory, MemoryItem, MemoryVisibility, UserRole } from "./memoryTypes.js";

export function canAccessMemory(role: UserRole, visibility: MemoryVisibility): boolean {
  if (role === "owner") return true;
  if (role === "trusted_contact") return visibility === "owner_only" || visibility === "trusted_contacts" || visibility === "public";
  if (role === "user" || role === "pending") return visibility === "public";
  return false;
}

export function getMemoryItems(memory: EswarMemory): MemoryItem[] {
  return [
    ...memory.projects,
    ...memory.people,
    ...memory.preferences,
    ...memory.important_memories
  ];
}

export function filterMemoryForRole(memory: EswarMemory, role: UserRole): MemoryItem[] {
  const now = Date.now();
  return getMemoryItems(memory).filter((item) => {
    if (item.expires_at && Date.parse(item.expires_at) < now) return false;
    return canAccessMemory(role, item.visibility);
  });
}

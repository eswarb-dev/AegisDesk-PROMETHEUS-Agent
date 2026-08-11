import type { EswarMemory, MemoryItem } from "./memoryTypes.js";

function itemLines(label: string, items: MemoryItem[]): string[] {
  if (!items.length) return [`${label}: none stored`];
  return [`${label}:`, ...items.slice(0, 12).map((item) => `- ${item.type}: ${item.content}`)];
}

export function formatMemoryContext(memory: EswarMemory): string {
  return [
    `Owner: ${memory.owner.name} (${memory.owner.preferred_name})`,
    `Tone: ${memory.personality_preferences.tone}`,
    `Response length: ${memory.personality_preferences.response_length}`,
    ...itemLines("Projects", memory.projects),
    ...itemLines("People", memory.people),
    ...itemLines("Preferences", memory.preferences),
    ...itemLines("Important memories", memory.important_memories),
    `Do not claim: ${memory.do_not_claim.join(" ")}`,
    `Sharing policy: ${memory.sharing_policy?.core_principle ?? "Private memory is owner-only."}`
  ].join("\n");
}

export function memoryStatus(memory: EswarMemory): string {
  return [
    "Memory: active",
    `Owner profile: ${memory.owner?.name ? "loaded" : "missing"}`,
    `Preferences: ${memory.preferences ? "loaded" : "missing"}`,
    `Projects: ${memory.projects ? "loaded" : "missing"}`,
    "Fallback mode: available"
  ].join("\n");
}

export function memorySummary(memory: EswarMemory): string {
  return [
    `Owner: ${memory.owner.preferred_name}`,
    `Projects stored: ${memory.projects.length}`,
    `People stored: ${memory.people.length}`,
    `Preferences stored: ${memory.preferences.length}`,
    `Important memories stored: ${memory.important_memories.length}`
  ].join("\n");
}

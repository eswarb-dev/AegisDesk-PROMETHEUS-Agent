import type { UserRole } from "../../memory/memoryTypes.js";

export function validatePlannedResponse(response: string, role: UserRole | "owner"): boolean {
  const normalized = response.toLowerCase();
  if (!response.trim()) return false;
  if (role === "owner" && /\bbro\b/.test(normalized)) return false;
  if (role === "owner" && !/\bsir\b/.test(normalized) && response.length > 20) return false;
  if (/\bas an ai language model\b|how can i assist you today\b/.test(normalized)) return false;
  if (/\bowner_only|raw owner memory|private owner memory\b/.test(normalized)) return false;
  if (/\bi am human|i feel exactly|i know exactly how you feel\b/.test(normalized)) return false;
  if (/\btrained myself|retrained my weights|updated my model weights\b/.test(normalized)) return false;
  const questionCount = response.match(/\?/g)?.length ?? 0;
  if (questionCount > 1) return false;
  return true;
}

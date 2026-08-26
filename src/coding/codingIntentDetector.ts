import type { CodingIntent } from "./codingTypes.js";

export function detectCodingIntent(text: string): CodingIntent {
  const trimmed = text.trim();
  const normalized = trimmed.toLowerCase();
  if (!trimmed) return { isCodingRequest: false, reason: "not_coding" };
  if (/^\/(?:code|solve|leetcode)(?:\s|$)/i.test(trimmed)) return { isCodingRequest: true, reason: "command" };
  if (/^\/\w+/.test(trimmed)) return { isCodingRequest: false, reason: "not_coding" };
  if (isLeetCodeStyle(trimmed)) return { isCodingRequest: true, reason: "leetcode_problem" };
  if (/\b(solve this|give code|write (?:a )?(?:solution|program|code)|leetcode|test cases|constraints|python code|java code|cpp code|c\+\+ code|javascript code|typescript code|c# code)\b/i.test(normalized)) {
    return { isCodingRequest: true, reason: "explicit_code" };
  }
  return { isCodingRequest: false, reason: "not_coding" };
}

export function isLeetCodeStyle(text: string): boolean {
  const normalized = text.toLowerCase();
  if (/\bleetcode\b/.test(normalized)) return true;
  if (/\bexample\s*\d*\s*:/.test(normalized) && /\bconstraints?\s*:/.test(normalized)) return true;
  if (/\bclass\s+solution\b|def\s+\w+\s*\(self,|public\s+\w+\s+\w+\s*\(/i.test(text)) return true;
  if (/^given\b/i.test(text) && /\b(return|find|calculate|determine)\b/i.test(text) && /\b(input|output|example|constraints?)\b/i.test(text)) return true;
  return false;
}

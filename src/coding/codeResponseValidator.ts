import type { CodeLanguage, ParsedProblemStatement } from "./codingTypes.js";
import { markdownLanguage } from "./leetcodeTemplateResolver.js";

export function validateCodeResponse(response: string, problem: ParsedProblemStatement, language: CodeLanguage): boolean {
  const normalized = response.toLowerCase();
  const needsCode = /code|solution|program|solve|leetcode/i.test(problem.rawPrompt) || problem.outputStyle !== "explain_then_code";
  if (needsCode && !/```[\s\S]+```/.test(response)) return false;
  if (/todo|pseudo-code|pseudocode|bro\b/i.test(response)) return false;
  if (/owner memory|private memory|api key|telegram token|supabase key/i.test(normalized)) return false;
  if (needsCode && !hasLanguageCompatibleCode(response, language)) return false;
  if (problem.functionSignature && !looselyIncludesSignature(response, problem.functionSignature)) return false;
  return true;
}

function hasLanguageCompatibleCode(response: string, language: CodeLanguage): boolean {
  const lang = markdownLanguage(language);
  if (new RegExp(`\`\`\`${lang}\\b`, "i").test(response)) return true;
  if (language === "python" && /class Solution:|def \w+\(/.test(response)) return true;
  if (language === "java" && /class Solution|public class/.test(response)) return true;
  if (language === "cpp" && /class Solution|#include|vector<|unordered_map/.test(response)) return true;
  if (language === "javascript" && /function |const \w+\s*=/.test(response)) return true;
  if (language === "typescript" && /function .*:|const \w+.*=>/.test(response)) return true;
  if (language === "csharp" && /class Solution|public class/.test(response)) return true;
  return false;
}

function looselyIncludesSignature(response: string, signature: string): boolean {
  const name = signature.match(/\b([a-zA-Z_]\w*)\s*\(/)?.[1];
  return !name || response.includes(name);
}

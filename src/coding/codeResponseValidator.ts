import type { CodeLanguage, ParsedProblemStatement } from "./codingTypes.js";
import { extractCodeBlocks } from "./codeBlockFormatter.js";
import { markdownLanguage } from "./leetcodeTemplateResolver.js";

export function validateCodeResponse(response: string, problem: ParsedProblemStatement, language: CodeLanguage): boolean {
  return getCodeResponseValidationError(response, problem, language) === null;
}

export function getCodeResponseValidationError(response: string, problem: ParsedProblemStatement, language: CodeLanguage): string | null {
  const normalized = response.toLowerCase();
  const needsCode = /code|solution|program|solve|leetcode/i.test(problem.rawPrompt) || problem.outputStyle !== "explain_then_code";
  if (needsCode && !/```[\s\S]+```/.test(response)) return "Code response must include a fenced code block.";
  if (/todo|pseudo-code|pseudocode|bro\b/i.test(response)) return "Code response cannot include TODO, pseudocode, or casual filler.";
  if (/owner memory|private memory|api key|telegram token|supabase key/i.test(normalized)) return "Code response cannot include private operational data.";
  if (needsCode && !hasLanguageCompatibleCode(response, language)) return "Code block language does not match the selected runtime.";
  const leetcodeError = getLeetCodeSubmissionError(response, problem, language);
  if (leetcodeError) return leetcodeError;
  if (problem.functionSignature && !looselyIncludesSignature(response, problem.functionSignature)) return "Code response does not include the requested function signature.";
  return null;
}

function hasLanguageCompatibleCode(response: string, language: CodeLanguage): boolean {
  const lang = markdownLanguage(language);
  if (new RegExp(`\`\`\`${lang}\\b`, "i").test(response)) return true;
  if ((language === "python" || language === "python3") && /class Solution:|def \w+\(/.test(response)) return true;
  if (language === "java" && /class Solution|public class/.test(response)) return true;
  if (language === "cpp" && /class Solution|#include|vector<|unordered_map/.test(response)) return true;
  if (language === "javascript" && /function |const \w+\s*=/.test(response)) return true;
  if (language === "typescript" && /function .*:|const \w+.*=>/.test(response)) return true;
  if (language === "csharp" && /class Solution|public class/.test(response)) return true;
  return false;
}

function getLeetCodeSubmissionError(response: string, problem: ParsedProblemStatement, language: CodeLanguage): string | null {
  if (problem.outputStyle !== "leetcode") return null;
  const codeBlocks = extractCodeBlocks(response);
  const blocksToInspect = codeBlocks.length ? codeBlocks : [response];
  if (language === "python") {
    for (const code of blocksToInspect) {
      if (/->/.test(code)) return "Python LeetCode mode cannot include Python3 type annotations.";
      if (/from\s+typing\s+import|typing\./i.test(code)) return "Python LeetCode mode cannot include Python3 type annotations.";
      if (/\b(List|Dict|Tuple|Optional|Set)\s*\[|list\s*\[/i.test(code)) return "Python LeetCode mode cannot include Python3 type annotations.";
      const defLines = code.split(/\r?\n/).filter((line) => /^\s*def\s+\w+\s*\(/.test(line));
      if (defLines.some((line) => /\)\s*->/.test(line) || /def\s+\w+\s*\([^)]*\w+\s*:\s*[^,)]+/.test(line))) {
        return "Python LeetCode mode cannot include Python3 type annotations.";
      }
    }
  }
  for (const code of blocksToInspect) {
    if (/\bassert\b/i.test(code)) return "LeetCode submission code cannot include assert tests.";
    if (/__name__\s*==\s*["']__main__["']|def\s+main\s*\(|\bmain\s*=/i.test(code)) return "LeetCode submission code cannot include local driver code.";
    if (/^\s*print\s*\(/m.test(code)) return "LeetCode submission code cannot include print-based local tests.";
  }
  if (language === "python3" && blocksToInspect.some((code) => /\bList\s*\[/.test(code) && !/from\s+typing\s+import\s+List/.test(code))) {
    return "Python3 LeetCode mode must include from typing import List when List[...] is used.";
  }
  return null;
}

function looselyIncludesSignature(response: string, signature: string): boolean {
  const name = signature.match(/\b([a-zA-Z_]\w*)\s*\(/)?.[1];
  return !name || response.includes(name);
}

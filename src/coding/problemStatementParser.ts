import type { CodeLanguage, DefaultCodeLanguage, ParsedProblemStatement, ProblemExample } from "./codingTypes.js";
import { detectCodingIntent } from "./codingIntentDetector.js";
import { languageFromText } from "./leetcodeTemplateResolver.js";

export function parseProblemStatement(input: { text: string; defaultLanguage: DefaultCodeLanguage; commandLanguage?: CodeLanguage }): ParsedProblemStatement {
  const rawPrompt = stripCodingCommand(input.text).trim();
  const fallbackLanguage = input.defaultLanguage === "ask" ? undefined : input.defaultLanguage;
  const language = input.commandLanguage ?? languageFromText(rawPrompt) ?? fallbackLanguage;
  const outputStyle = detectOutputStyle(rawPrompt);
  const examples = extractExamples(rawPrompt);
  const constraints = extractConstraints(rawPrompt);
  const functionSignature = extractFunctionSignature(rawPrompt);
  const title = extractTitle(rawPrompt);
  return {
    rawPrompt,
    title,
    description: rawPrompt,
    examples,
    constraints,
    functionSignature,
    language,
    outputStyle,
    wantsExplanation: !/\b(code only|only code|no explanation)\b/i.test(rawPrompt),
    wantsComplexity: !/\b(no complexity)\b/i.test(rawPrompt),
    wantsTests: /\b(test cases|include tests|with tests)\b/i.test(rawPrompt) || examples.length > 0
  };
}

export function stripCodingCommand(text: string): string {
  return text.replace(/^\/(?:code|solve|leetcode)\s*/i, "");
}

function detectOutputStyle(text: string): ParsedProblemStatement["outputStyle"] {
  if (/\b(code only|only code|just code)\b/i.test(text)) return "code_only";
  if (/\b(full program|stdin|stdout|input from stdin|college lab)\b/i.test(text)) return "full_program";
  if (detectCodingIntent(text).reason === "leetcode_problem" || /\bleetcode|class solution|function signature\b/i.test(text)) return "leetcode";
  return "explain_then_code";
}

function extractExamples(text: string): ProblemExample[] {
  const examples: ProblemExample[] = [];
  const pattern = /example\s*\d*\s*:\s*([\s\S]*?)(?=example\s*\d*\s*:|constraints?\s*:|$)/gi;
  for (const match of text.matchAll(pattern)) {
    const block = match[1].trim();
    const input = block.match(/input\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
    const output = block.match(/output\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
    const explanation = block.match(/explanation\s*:\s*([^\n]+)/i)?.[1]?.trim();
    if (input || output) examples.push({ input, output, explanation });
  }
  return examples;
}

function extractConstraints(text: string): string[] {
  const match = text.match(/constraints?\s*:\s*([\s\S]+)$/i);
  if (!match) return [];
  return match[1]
    .split(/\n|;/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

function extractFunctionSignature(text: string): string | undefined {
  return text.match(/def\s+\w+\s*\([^\n]+/i)?.[0]
    ?? text.match(/class\s+Solution[\s\S]{0,160}/i)?.[0]
    ?? text.match(/public\s+(?:int|long|String|boolean|double|int\[\])\s+\w+\s*\([^\n]+/i)?.[0]
    ?? undefined;
}

function extractTitle(text: string): string | undefined {
  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!firstLine) return undefined;
  if (firstLine.length <= 80 && !/^given\b/i.test(firstLine) && !/example|input|output|constraints/i.test(firstLine)) return firstLine;
  return undefined;
}

import type { ChatMessage } from "../../prometheus/groqClient.js";
import { logger } from "../../utils/logger.js";
import type { CodeLanguage, ParsedProblemStatement } from "../codingTypes.js";
import { getCodeResponseValidationError, validateCodeResponse } from "../codeResponseValidator.js";
import { buildRepairPrompt } from "../codingPromptBuilder.js";
import { shouldRepairProviderResponse } from "./codingProviderErrors.js";
import type { CodingProvider, CodingProviderResult } from "./codingProviderTypes.js";

export class CodingProviderRouter {
  constructor(private readonly providers: CodingProvider[]) {}

  async generateValid(input: {
    messages: ChatMessage[];
    problem: ParsedProblemStatement;
    language: CodeLanguage;
  }): Promise<CodingProviderResult> {
    let lastFailure: CodingProviderResult | undefined;
    for (const provider of this.providers) {
      const result = await provider.generate(input.messages);
      logAttempt(result);
      if (result.ok && validateCodeResponse(result.text, input.problem, input.language)) return result;
      const validationReason = result.ok
        ? getCodeResponseValidationError(result.text, input.problem, input.language) ?? `${result.provider}_invalid_response`
        : result.errorType;
      lastFailure = result.ok
        ? { ok: false, provider: result.provider, model: result.model, errorType: `${result.provider}_invalid_response` as never, message: validationReason, latencyMs: result.latencyMs }
        : result;
      if (shouldRepairProviderResponse(lastFailure.errorType)) {
        const repaired = await provider.generate([...input.messages, buildRepairPrompt(lastFailure.message)]);
        logAttempt(repaired);
        if (repaired.ok && validateCodeResponse(repaired.text, input.problem, input.language)) return repaired;
        if (repaired.ok) {
          const cleaned = safeCleanupPythonLeetCodeResponse(repaired.text, input.problem, input.language);
          if (cleaned && validateCodeResponse(cleaned, input.problem, input.language)) {
            return { ...repaired, text: cleaned };
          }
        }
        lastFailure = repaired.ok
          ? { ok: false, provider: repaired.provider, model: repaired.model, errorType: `${repaired.provider}_invalid_response` as never, message: getCodeResponseValidationError(repaired.text, input.problem, input.language) ?? `${repaired.provider}_invalid_response`, latencyMs: repaired.latencyMs }
          : repaired;
      }
    }
    return lastFailure ?? { ok: false, provider: "groq", model: "unknown", errorType: "groq_unknown_error", message: "groq_unknown_error", latencyMs: 0 };
  }
}

function safeCleanupPythonLeetCodeResponse(response: string, problem: ParsedProblemStatement, language: CodeLanguage): string | null {
  if (language !== "python" || problem.outputStyle !== "leetcode") return null;
  const validationReason = getCodeResponseValidationError(response, problem, language);
  if (!validationReason || !/Python LeetCode mode cannot include Python3 type annotations|assert tests|local driver code|print-based local tests/i.test(validationReason)) {
    return null;
  }
  const cleaned = response.replace(/```python\s*\n([\s\S]*?)```/gi, (_match, code: string) => {
    const cleanedCode = cleanupPythonLeetCodeCodeBlock(code);
    return `\`\`\`python\n${cleanedCode.trim()}\n\`\`\``;
  });
  return cleaned === response ? null : cleaned;
}

function cleanupPythonLeetCodeCodeBlock(code: string): string {
  const lines = code.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    if (/^\s*from\s+typing\s+import\b|^\s*import\s+typing\b/i.test(line)) continue;
    if (/^\s*assert\b/i.test(line)) continue;
    if (/^\s*print\s*\(/i.test(line)) continue;
    if (/__name__\s*==\s*["']__main__["']|^\s*def\s+main\s*\(/i.test(line)) break;
    kept.push(cleanPythonDefLine(line));
  }
  return kept.join("\n");
}

function cleanPythonDefLine(line: string): string {
  if (!/^\s*def\s+\w+\s*\(/.test(line)) return line;
  return line
    .replace(/\)\s*->\s*[^:]+:/, "):")
    .replace(/([,(]\s*\*{0,2}\w+)\s*:\s*[^,)=]+/g, "$1");
}

function logAttempt(result: CodingProviderResult): void {
  logger.info("coding_provider_attempt", {
    provider: result.provider,
    model: result.model,
    success: result.ok,
    errorType: result.ok ? undefined : result.errorType,
    latencyMs: result.latencyMs
  });
}

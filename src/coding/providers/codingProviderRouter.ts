import type { ChatMessage } from "../../prometheus/groqClient.js";
import { logger } from "../../utils/logger.js";
import type { CodeLanguage, ParsedProblemStatement } from "../codingTypes.js";
import { validateCodeResponse } from "../codeResponseValidator.js";
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
      lastFailure = result.ok
        ? { ok: false, provider: result.provider, model: result.model, errorType: `${result.provider}_invalid_response` as never, message: `${result.provider}_invalid_response`, latencyMs: result.latencyMs }
        : result;
      if (shouldRepairProviderResponse(lastFailure.errorType)) {
        const repaired = await provider.generate([...input.messages, buildRepairPrompt(lastFailure.errorType)]);
        logAttempt(repaired);
        if (repaired.ok && validateCodeResponse(repaired.text, input.problem, input.language)) return repaired;
        lastFailure = repaired.ok
          ? { ok: false, provider: repaired.provider, model: repaired.model, errorType: `${repaired.provider}_invalid_response` as never, message: `${repaired.provider}_invalid_response`, latencyMs: repaired.latencyMs }
          : repaired;
      }
    }
    return lastFailure ?? { ok: false, provider: "groq", model: "unknown", errorType: "groq_unknown_error", message: "groq_unknown_error", latencyMs: 0 };
  }
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

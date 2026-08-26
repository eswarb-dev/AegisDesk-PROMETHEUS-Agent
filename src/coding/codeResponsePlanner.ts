import type { AppConfig } from "../config.js";
import type { ChatMessage } from "../prometheus/groqClient.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import type { CodeLanguage, CodingModeConfig, ParsedProblemStatement } from "./codingTypes.js";
import { buildCodingPrompt } from "./codingPromptBuilder.js";
import { parseProblemStatement } from "./problemStatementParser.js";
import { markdownLanguage, resolveKnownTemplate } from "./leetcodeTemplateResolver.js";
import { formatLanguage, languageQuestion } from "./languageResolver.js";
import { pendingCodingRequests, type PendingCodingRequestRepository } from "./pendingCodingRequestRepository.js";
import { CodingProviderRouter } from "./providers/codingProviderRouter.js";
import { GroqCodingProvider } from "./providers/groqCodingProvider.js";
import { MistralCodingProvider } from "./providers/mistralCodingProvider.js";
import { MistralClient } from "../mistral/mistralClient.js";

type ChatEngine = {
  chat(messages: ChatMessage[]): Promise<string>;
};

export class CodeResponsePlanner {
  constructor(
    private readonly config: Pick<AppConfig, "ownerTelegramId"> & Partial<Pick<AppConfig, "coding" | "mistralApiKey" | "groqModel" | "groqModelPrimary" | "groqModelFallback">>,
    private readonly groq: ChatEngine,
    private readonly storage?: StorageProvider,
    private readonly pendingRequests: PendingCodingRequestRepository = pendingCodingRequests,
    private readonly providerRouter?: CodingProviderRouter
  ) {}

  async solve(input: { userId?: number; chatId?: number | string; text: string; commandLanguage?: CodeLanguage; forceLanguage?: CodeLanguage }): Promise<string> {
    const coding = this.config.coding ?? {
      enabled: true,
      defaultLanguage: "python" as const,
      provider: "groq" as const,
      providerFallback: "mistral" as const,
      includeExplanation: true,
      includeComplexity: true,
      includeTestCases: true,
      mistralEnabled: true,
      mistralCodeModel: "codestral-latest",
      mistralTimeoutMs: 30000,
      mistralMaxRetries: 1
    };
    if (!coding.enabled) return "Coding mode is disabled right now.";
    const owner = String(input.userId ?? "") === String(this.config.ownerTelegramId);
    const problem = parseProblemStatement({ text: input.text, defaultLanguage: coding.defaultLanguage, commandLanguage: input.commandLanguage ?? input.forceLanguage });
    const language = input.forceLanguage ?? problem.language;
    if (!language) {
      if (input.userId && input.chatId != null) {
        this.pendingRequests.save({
          userId: input.userId,
          chatId: input.chatId,
          originalProblem: problem.rawPrompt,
          parsedExamples: problem.examples,
          parsedConstraints: problem.constraints,
          detectedOutputStyle: problem.outputStyle
        });
      }
      return languageQuestion(owner);
    }
    await this.storeSafePreference(input.userId, language, problem);

    const template = resolveKnownTemplate(problem, language);
    if (template) return formatSolution({ owner, problem, language, code: template, coding });

    const router = this.providerRouter ?? this.createProviderRouter(coding);
    const result = await router.generateValid({
      messages: buildCodingPrompt({ problem, language, owner }),
      problem,
      language
    });
    return result.ok ? result.text : fallbackCodingReply(owner, problem);
  }

  private async storeSafePreference(userId: number | undefined, language: CodeLanguage, problem: ParsedProblemStatement): Promise<void> {
    if (!userId || this.storage?.kind !== "supabase") return;
    await this.storage.styles.upsertProfile({
      telegram_user_id: String(userId),
      role: String(userId) === String(this.config.ownerTelegramId) ? "owner" : "user",
      preferred_tone: "direct",
      preferred_reply_length: problem.wantsExplanation ? "medium" : "short",
      confidence: 0.65
    }).catch(() => undefined);
  }

  private createProviderRouter(coding: CodingModeConfig): CodingProviderRouter {
    const providers = [];
    const groqModel = coding.codeModel ?? this.config.groqModelPrimary ?? this.config.groqModel ?? "groq-coding";
    providers.push(new GroqCodingProvider(this.groq, groqModel));
    if (coding.mistralEnabled && coding.providerFallback === "mistral") {
      const model = coding.mistralCodeModel || "codestral-latest";
      providers.push(new MistralCodingProvider(new MistralClient({
        apiKey: this.config.mistralApiKey,
        model,
        timeoutMs: coding.mistralTimeoutMs,
        maxRetries: coding.mistralMaxRetries
      }), model));
    }
    return new CodingProviderRouter(providers);
  }
}

export async function solvePendingCodingRequest(input: {
  userId: number;
  chatId: number | string;
  language: CodeLanguage;
  planner: CodeResponsePlanner;
  pendingRequests?: PendingCodingRequestRepository;
}): Promise<string | null> {
  const repo = input.pendingRequests ?? pendingCodingRequests;
  const pending = repo.get(input.userId, input.chatId);
  if (!pending) return null;
  repo.clear(input.userId, input.chatId);
  const response = await input.planner.solve({
    userId: input.userId,
    chatId: input.chatId,
    text: pending.originalProblem,
    forceLanguage: input.language
  });
  return [`Yes, Sir. Solving it in ${formatLanguage(input.language)}.`, "", response].join("\n");
}

export function formatSolution(input: { owner: boolean; problem: ParsedProblemStatement; language: CodeLanguage; code: string; coding: CodingModeConfig }): string {
  if (input.problem.outputStyle === "code_only") {
    return `\`\`\`${markdownLanguage(input.language)}\n${input.code}\n\`\`\``;
  }
  const intro = input.owner ? "Yes, Sir. This is a sliding-window/hash-map style problem." : "This is a direct coding problem.";
  const sections = [
    input.problem.wantsExplanation && input.coding.includeExplanation ? `Problem approach:\n${intro}\nUse the suitable data structure to track what has already been seen and update the answer in one pass.` : "",
    `Code:\n\`\`\`${markdownLanguage(input.language)}\n${input.code}\n\`\`\``,
    input.problem.wantsComplexity && input.coding.includeComplexity ? "Complexity:\nTime: O(n)\nSpace: O(n)" : "",
    input.problem.wantsTests && input.coding.includeTestCases ? "Test cases:\n- Given examples should match expected output.\n- Empty or minimum-size input should be handled.\n- Duplicate-heavy input should be handled." : ""
  ].filter(Boolean);
  return sections.join("\n\n");
}

function fallbackCodingReply(owner: boolean, problem: ParsedProblemStatement): string {
  const prefix = owner ? "Sir, coding engine is unavailable right now." : "Coding engine is unavailable right now.";
  const hint = problem.rawPrompt.length ? " I can still help with the approach in basic mode." : "";
  return `${prefix}${hint}`;
}

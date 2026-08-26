export type CodeLanguage = "python" | "python3" | "java" | "cpp" | "javascript" | "typescript" | "csharp";
export type DefaultCodeLanguage = CodeLanguage | "ask";

export type CodingOutputStyle = "leetcode" | "full_program" | "code_only" | "explain_then_code";

export type CodingIntent = {
  isCodingRequest: boolean;
  reason: "command" | "explicit_code" | "leetcode_problem" | "not_coding";
};

export type ProblemExample = {
  input: string;
  output: string;
  explanation?: string;
};

export type ParsedProblemStatement = {
  rawPrompt: string;
  title?: string;
  description: string;
  inputFormat?: string;
  outputFormat?: string;
  examples: ProblemExample[];
  constraints: string[];
  functionSignature?: string;
  language?: CodeLanguage;
  outputStyle: CodingOutputStyle;
  wantsExplanation: boolean;
  wantsComplexity: boolean;
  wantsTests: boolean;
};

export type CodingModeConfig = {
  enabled: boolean;
  defaultLanguage: DefaultCodeLanguage;
  includeExplanation: boolean;
  includeComplexity: boolean;
  includeTestCases: boolean;
  provider: "groq" | "mistral";
  providerFallback: "groq" | "mistral" | "none";
  codeModel?: string;
  codeModelFallback?: string;
  mistralEnabled: boolean;
  mistralCodeModel: string;
  mistralCodeModelFallback?: string;
  mistralTimeoutMs: number;
  mistralMaxRetries: number;
};

export type PendingCodingRequest = {
  userId: string;
  chatId: string;
  originalProblem: string;
  parsedExamples: ProblemExample[];
  parsedConstraints: string[];
  detectedOutputStyle: CodingOutputStyle;
  createdAt: string;
  expiresAt: string;
};

export type CodingSolution = {
  language: CodeLanguage;
  content: string;
};

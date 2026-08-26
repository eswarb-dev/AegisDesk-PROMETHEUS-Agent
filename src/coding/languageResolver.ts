import type { CodeLanguage, DefaultCodeLanguage } from "./codingTypes.js";

const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  python: "Python",
  java: "Java",
  cpp: "C++",
  javascript: "JavaScript",
  typescript: "TypeScript",
  csharp: "C#"
};

export function normalizeCodeLanguage(value?: string | null): CodeLanguage | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "py" || normalized === "python") return "python";
  if (normalized === "java") return "java";
  if (normalized === "cpp" || normalized === "c++") return "cpp";
  if (normalized === "js" || normalized === "javascript") return "javascript";
  if (normalized === "ts" || normalized === "typescript") return "typescript";
  if (normalized === "c#" || normalized === "cs" || normalized === "csharp" || normalized === "c sharp") return "csharp";
  return undefined;
}

export function normalizeDefaultCodeLanguage(value?: string | null): DefaultCodeLanguage {
  if (value?.trim().toLowerCase() === "ask") return "ask";
  return normalizeCodeLanguage(value) ?? "ask";
}

export function formatLanguage(language: CodeLanguage): string {
  return LANGUAGE_LABELS[language];
}

export function languageQuestion(owner: boolean): string {
  return owner
    ? "Which language do you need the solution in, Sir?\nPython, Java, C++, JavaScript, TypeScript, or C#?"
    : "Which language do you need the solution in?\nPython, Java, C++, JavaScript, TypeScript, or C#?";
}

export function isAskDefault(value: DefaultCodeLanguage): value is "ask" {
  return value === "ask";
}

import type { CodeLanguage, ParsedProblemStatement } from "./codingTypes.js";
import type { ChatMessage } from "../prometheus/groqClient.js";

export function buildCodingPrompt(input: { problem: ParsedProblemStatement; language: CodeLanguage; owner: boolean }): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are PROMETHEUS Coding Mode.",
        "Read the entire programming problem before answering.",
        "Use all examples, constraints, and requested language.",
        "Return correct, clean, executable code.",
        "Do not invent missing constraints.",
        "If the request is LeetCode-style, return LeetCode-compatible class/function.",
        "If full stdin/stdout program is requested, return a full runnable program.",
        "Keep the answer concise.",
        input.owner ? "Address Eswar as Sir outside code blocks only. Never put Sir in code comments." : ""
      ].join("\n")
    },
    {
      role: "system",
      content: JSON.stringify({
        mode: "coding_problem_solver",
        language: input.language,
        problem_statement: input.problem.description,
        examples: input.problem.examples,
        constraints: input.problem.constraints,
        requested_output_style: input.problem.outputStyle,
        function_signature: input.problem.functionSignature ?? null,
        include_explanation: input.problem.wantsExplanation,
        include_complexity: input.problem.wantsComplexity,
        include_test_cases: input.problem.wantsTests
      })
    },
    { role: "user", content: input.problem.rawPrompt }
  ];
}

export function buildRepairPrompt(reason: string): ChatMessage {
  return {
    role: "user",
    content: `The previous answer failed validation because: ${reason}.\nRegenerate the solution correctly.\nReturn only the required format.`
  };
}

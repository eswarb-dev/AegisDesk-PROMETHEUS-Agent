import { describe, expect, it, vi } from "vitest";
import { detectCodingIntent } from "../src/coding/codingIntentDetector.js";
import { splitTelegramMarkdown } from "../src/coding/codeBlockFormatter.js";
import { CodeResponsePlanner, solvePendingCodingRequest } from "../src/coding/codeResponsePlanner.js";
import { validateCodeResponse } from "../src/coding/codeResponseValidator.js";
import { normalizeCodeLanguage, normalizeDefaultCodeLanguage } from "../src/coding/languageResolver.js";
import { PendingCodingRequestRepository } from "../src/coding/pendingCodingRequestRepository.js";
import { parseProblemStatement } from "../src/coding/problemStatementParser.js";
import { decideResponseMode } from "../src/prometheus/responseModeDecider.js";

const config = {
  ownerTelegramId: "1001",
  coding: {
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
  }
};

const askConfig = {
  ...config,
  coding: {
    ...config.coding,
    defaultLanguage: "ask" as const
  }
};

describe("coding response mode", () => {
  it("detects explicit and LeetCode coding requests", () => {
    expect(detectCodingIntent("/leetcode two sum").isCodingRequest).toBe(true);
    expect(detectCodingIntent("/solve longest substring").isCodingRequest).toBe(true);
    expect(detectCodingIntent("give code for two sum").isCodingRequest).toBe(true);
    expect(detectCodingIntent("Given an array nums...\nExample 1:\nInput: nums=[2,7], target=9\nOutput: [0,1]\nConstraints:\n2 <= nums.length").isCodingRequest).toBe(true);
  });

  it("does not treat normal chat or commands as coding", () => {
    expect(detectCodingIntent("Prometheus, are you there?").isCodingRequest).toBe(false);
    expect(detectCodingIntent("Explain sliding window").isCodingRequest).toBe(false);
    expect(detectCodingIntent("/tell vathanya hi").isCodingRequest).toBe(false);
    expect(decideResponseMode("/contacts").mode).toBe("DETERMINISTIC_COMMAND");
  });

  it("routes coding prompts to CODING_PROBLEM_SOLVER", () => {
    expect(decideResponseMode("/leetcode two sum").mode).toBe("CODING_PROBLEM_SOLVER");
    expect(decideResponseMode("solve this in java").mode).toBe("CODING_PROBLEM_SOLVER");
  });

  it("parses examples, constraints, language, and LeetCode style", () => {
    const parsed = parseProblemStatement({
      text: "Longest Substring\nGiven a string s, find the length.\nExample 1:\nInput: s = \"abcabcbb\"\nOutput: 3\nConstraints:\n0 <= s.length <= 5 * 10^4\nPython code",
      defaultLanguage: "java"
    });

    expect(parsed.title).toBe("Longest Substring");
    expect(parsed.language).toBe("python");
    expect(parsed.examples[0]).toMatchObject({ input: "s = \"abcabcbb\"", output: "3" });
    expect(parsed.constraints[0]).toContain("s.length");
    expect(parsed.outputStyle).toBe("leetcode");
  });

  it("detects full program and code-only requests", () => {
    expect(parseProblemStatement({ text: "solve this with input from stdin in cpp", defaultLanguage: "python" }).outputStyle).toBe("full_program");
    expect(parseProblemStatement({ text: "two sum python code only", defaultLanguage: "python" }).outputStyle).toBe("code_only");
  });

  it("asks for language when coding problem has no language and default is ask", async () => {
    const repo = new PendingCodingRequestRepository();
    const planner = new CodeResponsePlanner(askConfig, { chat: vi.fn() }, undefined, repo);

    const response = await planner.solve({ userId: 1001, chatId: 1001, text: "solve two sum" });

    expect(response).toContain("Which language do you need the solution in, Sir?");
    expect(response).toContain("Python, Java, C++");
    expect(repo.get(1001, 1001)).toMatchObject({
      userId: "1001",
      chatId: "1001",
      originalProblem: "solve two sum",
      detectedOutputStyle: "explain_then_code"
    });
  });

  it("does not silently use Python when default language is ask", async () => {
    const repo = new PendingCodingRequestRepository();
    const groq = { chat: vi.fn() };
    const planner = new CodeResponsePlanner(askConfig, groq, undefined, repo);

    const response = await planner.solve({ userId: 1001, chatId: 1001, text: "Given a string s, find the length of the longest substring without repeating characters." });

    expect(response).not.toContain("```python");
    expect(response).toContain("Which language");
    expect(groq.chat).not.toHaveBeenCalled();
  });

  it("solves pending request when user replies with Java or C++", async () => {
    const repo = new PendingCodingRequestRepository();
    const planner = new CodeResponsePlanner(askConfig, { chat: vi.fn() }, undefined, repo);

    await planner.solve({ userId: 1001, chatId: 1001, text: "solve two sum" });
    const javaResponse = await solvePendingCodingRequest({ userId: 1001, chatId: 1001, language: "java", planner, pendingRequests: repo });

    expect(javaResponse).toContain("Solving it in Java");
    expect(javaResponse).toContain("```java");
    expect(javaResponse).toContain("int[] twoSum");
    expect(repo.get(1001, 1001)).toBeNull();

    await planner.solve({ userId: 1001, chatId: 1001, text: "solve two sum" });
    const cppResponse = await solvePendingCodingRequest({ userId: 1001, chatId: 1001, language: "cpp", planner, pendingRequests: repo });
    expect(cppResponse).toContain("Solving it in C++");
    expect(cppResponse).toContain("```cpp");
    expect(cppResponse).toContain("vector<int> twoSum");
  });

  it("expires pending coding request after ten minutes", () => {
    const repo = new PendingCodingRequestRepository();
    const now = new Date("2026-08-26T00:00:00.000Z");
    repo.save({
      userId: 1001,
      chatId: 1001,
      originalProblem: "solve two sum",
      parsedExamples: [],
      parsedConstraints: [],
      detectedOutputStyle: "explain_then_code",
      now
    });

    expect(repo.get(1001, 1001, new Date(now.getTime() + 9 * 60 * 1000))).not.toBeNull();
    expect(repo.get(1001, 1001, new Date(now.getTime() + 10 * 60 * 1000 + 1))).toBeNull();
  });

  it("explicit language solves directly even when default is ask", async () => {
    const repo = new PendingCodingRequestRepository();
    const planner = new CodeResponsePlanner(askConfig, { chat: vi.fn() }, undefined, repo);

    const response = await planner.solve({ userId: 1001, chatId: 1001, text: "solve two sum in Python" });

    expect(response).toContain("```python");
    expect(repo.get(1001, 1001)).toBeNull();
  });

  it("normalizes coding language aliases and ask default", () => {
    expect(normalizeCodeLanguage("c++")).toBe("cpp");
    expect(normalizeCodeLanguage("cpp")).toBe("cpp");
    expect(normalizeCodeLanguage("c#")).toBe("csharp");
    expect(normalizeCodeLanguage("cs")).toBe("csharp");
    expect(normalizeCodeLanguage("js")).toBe("javascript");
    expect(normalizeCodeLanguage("ts")).toBe("typescript");
    expect(normalizeDefaultCodeLanguage("ask")).toBe("ask");
  });

  it("returns deterministic longest substring Python solution", async () => {
    const groq = { chat: vi.fn() };
    const planner = new CodeResponsePlanner(config, groq);

    const response = await planner.solve({
      userId: 1001,
      text: "Given a string s, find the length of the longest substring without duplicate characters. Example 1: Input: s = \"abcabcbb\" Output: 3 Constraints: 0 <= s.length <= 5 * 10^4 Python code."
    });

    expect(response).toContain("class Solution");
    expect(response).toContain("lengthOfLongestSubstring");
    expect(response).toContain("seen = {}");
    expect(response).toContain("Time: O(n)");
    expect(groq.chat).not.toHaveBeenCalled();
  });

  it("returns Java solution when requested", async () => {
    const planner = new CodeResponsePlanner(config, { chat: vi.fn() });
    const response = await planner.solve({ userId: 1001, text: "leetcode two sum in java code" });

    expect(response).toContain("```java");
    expect(response).toContain("class Solution");
    expect(response).toContain("int[] twoSum");
  });

  it("code-only response returns only a code block", async () => {
    const planner = new CodeResponsePlanner(config, { chat: vi.fn() });
    const response = await planner.solve({ userId: 1001, text: "two sum python code only" });

    expect(response.trim().startsWith("```python")).toBe(true);
    expect(response).not.toContain("Problem approach:");
  });

  it("validator rejects unsafe or incomplete coding responses", () => {
    const parsed = parseProblemStatement({ text: "two sum python code", defaultLanguage: "python" });

    expect(validateCodeResponse("Explanation only", parsed, "python")).toBe(false);
    expect(validateCodeResponse("```python\n# TODO\n```", parsed, "python")).toBe(false);
    expect(validateCodeResponse("```java\nclass Solution {}\n```\nbro", parsed, "python")).toBe(false);
  });

  it("splits long coding responses without breaking ordinary code blocks when possible", () => {
    const response = `Intro\n\n\`\`\`python\n${"print('x')\n".repeat(120)}\`\`\`\n\nDone`;
    const parts = splitTelegramMarkdown(response, 500);

    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]).toContain("Intro");
    expect(parts.some((part) => part.includes("```python"))).toBe(true);
  });
});

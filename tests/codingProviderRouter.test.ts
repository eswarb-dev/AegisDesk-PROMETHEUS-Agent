import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../src/prometheus/groqClient.js";
import { CodeResponsePlanner } from "../src/coding/codeResponsePlanner.js";
import { CodingProviderRouter } from "../src/coding/providers/codingProviderRouter.js";
import type { CodingProvider } from "../src/coding/providers/codingProviderTypes.js";

const validPython = "```python\nclass Solution:\n    def maxSubArray(self, nums: list[int]) -> int:\n        best = cur = nums[0]\n        for value in nums[1:]:\n            cur = max(value, cur + value)\n            best = max(best, cur)\n        return best\n```";
const validJava = "```java\nclass Solution { public int maxSubArray(int[] nums) { int best = nums[0], cur = nums[0]; for (int i = 1; i < nums.length; i++) { cur = Math.max(nums[i], cur + nums[i]); best = Math.max(best, cur); } return best; } }\n```";

const config = {
  ownerTelegramId: "1001",
  groqModel: "groq-primary",
  groqModelPrimary: "groq-primary",
  groqModelFallback: "groq-fallback",
  mistralApiKey: "test-key",
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

function provider(name: "groq" | "mistral", model: string, results: Array<string | Error>): CodingProvider {
  const generate = vi.fn(async (_messages: ChatMessage[]) => {
    const next = results.shift();
    if (next instanceof Error) {
      return { ok: false as const, provider: name, model, errorType: next.message as never, message: next.message, latencyMs: 1 };
    }
    return { ok: true as const, provider: name, model, text: next ?? validPython, latencyMs: 1 };
  });
  return { provider: name, model, generate };
}

describe("coding provider router", () => {
  it("Groq primary success returns Groq response", async () => {
    const groq = provider("groq", "groq-primary", [validPython]);
    const router = new CodingProviderRouter([groq]);
    const planner = new CodeResponsePlanner(config, { chat: vi.fn() }, undefined, undefined, router);

    const response = await planner.solve({ userId: 1001, chatId: 1001, text: "solve maximum subarray in python code" });

    expect(response).toBe(validPython);
    expect(groq.generate).toHaveBeenCalledOnce();
  });

  it("Groq failure tries Mistral fallback", async () => {
    const groq = provider("groq", "groq-primary", [new Error("groq_timeout")]);
    const mistral = provider("mistral", "codestral-latest", [validJava]);
    const planner = new CodeResponsePlanner(config, { chat: vi.fn() }, undefined, undefined, new CodingProviderRouter([groq, mistral]));

    const response = await planner.solve({ userId: 1001, chatId: 1001, text: "solve maximum subarray in java code" });

    expect(response).toContain("```java");
    expect(groq.generate).toHaveBeenCalledOnce();
    expect(mistral.generate).toHaveBeenCalledOnce();
  });

  it("Groq 429 tries fallback provider", async () => {
    const groq = provider("groq", "groq-primary", [new Error("groq_429")]);
    const mistral = provider("mistral", "codestral-latest", [validPython]);
    const planner = new CodeResponsePlanner(config, { chat: vi.fn() }, undefined, undefined, new CodingProviderRouter([groq, mistral]));

    const response = await planner.solve({ userId: 1001, chatId: 1001, text: "solve maximum subarray in python code" });

    expect(response).toBe(validPython);
    expect(mistral.generate).toHaveBeenCalledOnce();
  });

  it("Mistral invalid response triggers one repair and accepts repaired answer", async () => {
    const groq = provider("groq", "groq-primary", [new Error("groq_network_error")]);
    const mistral = provider("mistral", "codestral-latest", ["Explanation only", validPython]);
    const planner = new CodeResponsePlanner(config, { chat: vi.fn() }, undefined, undefined, new CodingProviderRouter([groq, mistral]));

    const response = await planner.solve({ userId: 1001, chatId: 1001, text: "solve maximum subarray in python code" });

    expect(response).toBe(validPython);
    expect(mistral.generate).toHaveBeenCalledTimes(2);
  });

  it("all providers fail returns safe fallback", async () => {
    const groq = provider("groq", "groq-primary", [new Error("groq_timeout")]);
    const mistral = provider("mistral", "codestral-latest", [new Error("mistral_auth_error")]);
    const planner = new CodeResponsePlanner(config, { chat: vi.fn() }, undefined, undefined, new CodingProviderRouter([groq, mistral]));

    const response = await planner.solve({ userId: 1001, chatId: 1001, text: "unknown hard problem in python code" });

    expect(response).toContain("Sir, coding engine is unavailable right now");
  });

  it("missing language in ask mode does not call providers", async () => {
    const groq = provider("groq", "groq-primary", [validPython]);
    const askConfig = { ...config, coding: { ...config.coding, defaultLanguage: "ask" as const } };
    const planner = new CodeResponsePlanner(askConfig, { chat: vi.fn() }, undefined, undefined, new CodingProviderRouter([groq]));

    const response = await planner.solve({ userId: 1001, chatId: 1001, text: "solve two sum" });

    expect(response).toContain("Which language");
    expect(groq.generate).not.toHaveBeenCalled();
  });
});

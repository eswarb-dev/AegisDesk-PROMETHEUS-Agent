import type { AppConfig } from "../config.js";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class GroqClient {
  constructor(
    private readonly config: Pick<AppConfig, "groqApiKey" | "groqModel">,
    private readonly timeoutMs = 12000,
    private readonly retries = 1
  ) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    if (!this.config.groqApiKey) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.groqApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: this.config.groqModel,
            messages,
            temperature: 0.7,
            max_tokens: 700
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Groq request failed with ${response.status}`);
        }

        const body = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = body.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error("Groq returned an empty response");
        return content;
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Groq request failed");
  }
}

import type { ChatMessage } from "../../prometheus/groqClient.js";
import { GroqClient } from "../../prometheus/groqClient.js";
import { validateDraftInput } from "./gmailPolicy.js";
import type { GmailDraftConfig, MailDraftInput } from "./gmailTypes.js";

type ChatEngine = { chat(messages: ChatMessage[]): Promise<string> };

export class GmailDraftSkill {
  constructor(
    private readonly config: GmailDraftConfig & { groqApiKey?: string; groqModel: string },
    private readonly groq: ChatEngine = new GroqClient(config)
  ) {}

  async buildAiDraft(to: string[], purpose: string): Promise<MailDraftInput> {
    if (!purpose.trim()) throw new Error("purpose is required");
    const response = await this.groq.chat([
      {
        role: "system",
        content: [
          "You are PROMETHEUS drafting an email for Eswar B.",
          "Write concise, respectful, natural emails.",
          "Do not invent facts.",
          "Do not add claims not provided.",
          "Do not include signatures unless requested.",
          "Return JSON only: {\"subject\":\"...\",\"body\":\"...\"}"
        ].join("\n")
      },
      { role: "user", content: `Recipient: ${to.join(", ")}\nPurpose: ${purpose}` }
    ]);
    const parsed = JSON.parse(response) as { subject?: string; body?: string };
    const draft = { to, subject: parsed.subject?.trim() ?? "", body: parsed.body?.trim() ?? "" };
    const policy = validateDraftInput(draft);
    if (!policy.ok) throw new Error(policy.reason);
    return draft;
  }
}

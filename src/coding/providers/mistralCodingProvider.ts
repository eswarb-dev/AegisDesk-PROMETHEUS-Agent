import type { ChatMessage } from "../../prometheus/groqClient.js";
import type { MistralClient } from "../../mistral/mistralClient.js";
import type { CodingProvider, CodingProviderResult } from "./codingProviderTypes.js";

export class MistralCodingProvider implements CodingProvider {
  readonly provider = "mistral" as const;

  constructor(
    private readonly client: MistralClient,
    readonly model: string
  ) {}

  async generate(messages: ChatMessage[]): Promise<CodingProviderResult> {
    return this.client.chat(messages);
  }
}

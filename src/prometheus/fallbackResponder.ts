import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fallbackPath = path.resolve(__dirname, "../data/fallback_responses.json");

export type FallbackKey = "owner_api_error" | "owner_unknown" | "api_error" | "unknown" | "non_owner";
export type FallbackResponses = Partial<Record<FallbackKey, string[]>>;

export class FallbackResponder {
  private responses?: FallbackResponses;

  constructor(private readonly filePath = fallbackPath) {}

  async load(): Promise<FallbackResponses> {
    if (this.responses) return this.responses;
    this.responses = JSON.parse(await fs.readFile(this.filePath, "utf8")) as FallbackResponses;
    return this.responses;
  }

  async pick(key: FallbackKey): Promise<string> {
    const responses = await this.load();
    const list = responses[key] ?? responses.owner_unknown ?? responses.unknown ?? ["I don't have that in memory yet, so I won't guess."];
    return list[Math.floor(Math.random() * list.length)];
  }
}

export const fallbackResponder = new FallbackResponder();

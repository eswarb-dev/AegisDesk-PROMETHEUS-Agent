import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  defaultConversationSummariesData,
  defaultEswarMemoryData,
  defaultShareIndexData,
  defaultTrustedContactsData,
  defaultUserMemoriesData
} from "./defaultData.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureJson(fileName: string, data: unknown): Promise<void> {
  const filePath = path.join(__dirname, fileName);
  await mkdir(path.dirname(filePath), { recursive: true });
  try {
    await access(filePath, constants.F_OK);
  } catch {
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  }
}

export async function seedRuntimeData(): Promise<void> {
  await ensureJson("trusted_contacts.json", defaultTrustedContactsData);
  await ensureJson("user_memories.json", defaultUserMemoriesData);
  await ensureJson("conversation_summaries.json", defaultConversationSummariesData);
  await ensureJson("eswar_memory.json", defaultEswarMemoryData);
  await ensureJson("eswar_share_index.json", defaultShareIndexData);
}

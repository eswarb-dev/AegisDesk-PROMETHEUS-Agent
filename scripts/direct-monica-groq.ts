import { loadConfig } from "../src/config.js";
import { GroqClient, type ChatMessage } from "../src/prometheus/groqClient.js";

const monicaMessage = [
  "Monica is my friend and this is mainly about friendship reciprocity.",
  "She trusted me with personal problems, I listened properly, understood her side, and tried to support her emotionally.",
  "After that I felt like our bond became deeper from my side, but now I feel left behind because I am usually the one checking on her.",
  "She has her male best friend and Durga around her, and even the Onam celebration day in our college is only a small context here.",
  "The thing hurting me is that I keep investing, advising, and remembering her, but she does not naturally follow me on her private Instagram or choose me the same way."
].join(" ");

const minimalSystemPrompt = "You are PROMETHEUS. Read the complete owner message and respond specifically to the primary personal situation. Be concise, grounded, and do not overclaim anyone's intentions.";

async function main(): Promise<void> {
  const config = loadConfig({ ...process.env, NODE_ENV: process.env.NODE_ENV ?? "development" });
  if (!config.groqApiKey) throw new Error("GROQ_API_KEY is required for the direct Groq comparison script.");

  const primary = config.groqModelPrimary ?? config.groqModel;
  const fallback = config.groqModelFallback;
  const messages: ChatMessage[] = [
    { role: "system", content: minimalSystemPrompt },
    { role: "user", content: monicaMessage }
  ];

  console.log("Direct Groq Monica comparison");
  console.log(`message chars: ${monicaMessage.length}`);

  for (const [label, model] of [["primary", primary], ["fallback", fallback]] as const) {
    if (!model) {
      console.log(`${label}: not configured`);
      continue;
    }
    const client = new GroqClient({ ...config, groqModel: model, groqModelPrimary: model, groqModelFallback: undefined }, 30000, 0);
    const result = await client.chatWithStatus(messages);
    console.log(`\n${label} model: ${model}`);
    if (!result.ok) {
      console.log(`result: failed (${result.errorType})`);
      continue;
    }
    console.log("result: success");
    console.log(`response chars: ${result.content.length}`);
    console.log(result.content);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
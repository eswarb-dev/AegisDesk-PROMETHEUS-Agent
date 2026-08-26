import type { Context } from "telegraf";
import type { AppConfig } from "../config.js";
import { defaultCodingConfig } from "../config.js";
import { isOwner } from "../memory/ownerMemory.js";
import { GroqClient } from "../prometheus/groqClient.js";
import type { StorageProvider } from "../storage/storageProvider.js";
import { CodeResponsePlanner } from "../coding/codeResponsePlanner.js";
import { splitTelegramMarkdown } from "../coding/codeBlockFormatter.js";
import { languageFromText } from "../coding/leetcodeTemplateResolver.js";
import { formatLanguage, normalizeCodeLanguage } from "../coding/languageResolver.js";
import type { CodeLanguage } from "../coding/codingTypes.js";

export async function codeCommand(ctx: Context, config: AppConfig, storage?: StorageProvider): Promise<void> {
  const coding = config.coding ?? defaultCodingConfig();
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  const command = text.trim().split(/\s+/, 1)[0]?.replace("/", "").toLowerCase();
  const prompt = text.replace(/^\/(?:code|solve|leetcode)\s*/i, "").trim();
  if (!prompt) {
    await ctx.reply("Usage: /code <prompt>\n/solve <problem>\n/leetcode <problem>");
    return;
  }
  const planner = new CodeResponsePlanner(config, new GroqClient({
    ...config,
    groqModelPrimary: coding.codeModel ?? config.groqModelPrimary ?? config.groqModel,
    groqModelFallback: coding.codeModelFallback ?? config.groqModelFallback
  }), storage);
  const response = await planner.solve({
    userId: ctx.from?.id,
    chatId: ctx.chat?.id,
    text,
    commandLanguage: command === "leetcode"
      ? languageFromText(prompt) ?? (coding.defaultLanguage === "ask" ? undefined : coding.defaultLanguage)
      : languageFromText(prompt)
  });
  for (const part of splitTelegramMarkdown(response)) {
    await ctx.reply(part);
  }
}

export async function codeConfigCommand(ctx: Context, config: AppConfig): Promise<void> {
  if (!isOwner(ctx.from?.id, config)) {
    await ctx.reply("PROMETHEUS is active.\nThis command is owner-restricted.");
    return;
  }
  const text = (ctx.message as { text?: string } | undefined)?.text ?? "";
  const language = text.match(/^\/codeconfig\s+language\s+(\S+)/i)?.[1]?.toLowerCase();
  if (language) {
    if (language === "ask") {
      process.env.DEFAULT_CODE_LANGUAGE = "ask";
      config.coding = config.coding ?? defaultCodingConfig();
      config.coding.defaultLanguage = "ask";
      await ctx.reply("Default coding language cleared, Sir. I’ll ask before generating code when the language is not specified.");
      return;
    }
    const normalized = normalizeCodeLanguage(language);
    if (!normalized) {
      await ctx.reply("Supported languages: ask, python, java, cpp, c++, javascript, js, typescript, ts, csharp, c#, cs");
      return;
    }
    process.env.DEFAULT_CODE_LANGUAGE = normalized;
    config.coding = config.coding ?? defaultCodingConfig();
    config.coding.defaultLanguage = normalized;
    await ctx.reply(`Default coding language set to ${formatLanguage(normalized)}, Sir.`);
    return;
  }
  await ctx.reply([
    "PROMETHEUS Coding Mode",
    "",
    "Language:",
    `${(config.coding ?? defaultCodingConfig()).defaultLanguage}`,
    "",
    "Primary:",
    `Groq / ${(config.coding ?? defaultCodingConfig()).codeModel ?? config.groqModelPrimary ?? config.groqModel}`,
    "",
    "Fallback:",
    `Groq / ${(config.coding ?? defaultCodingConfig()).codeModelFallback ?? config.groqModelFallback ?? "not configured"}`,
    `Mistral / ${(config.coding ?? defaultCodingConfig()).mistralCodeModel}`,
    "",
    "Mistral:",
    `${(config.coding ?? defaultCodingConfig()).mistralEnabled ? "enabled" : "disabled"}`,
    "",
    `Explanation: ${(config.coding ?? defaultCodingConfig()).includeExplanation ? "yes" : "no"}`,
    `Complexity: ${(config.coding ?? defaultCodingConfig()).includeComplexity ? "yes" : "no"}`,
    `Test cases: ${(config.coding ?? defaultCodingConfig()).includeTestCases ? "yes" : "no"}`
  ].join("\n"));
}

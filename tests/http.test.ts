import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createApp } from "../src/index.js";
import { config } from "../src/config.js";
import { registerWebhook, TELEGRAM_WEBHOOK_PATH } from "../src/telegram/webhook.js";

describe("HTTP endpoints", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("health endpoint returns ok without calling Groq", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await request(createApp()).get("/health").expect(200);

    expect(response.body).toMatchObject({
      status: "ok",
      service: "prometheus-telegram-bot",
      memory: expect.stringMatching(/^supabase_(connected|degraded)$/),
      groq: expect.stringMatching(/^(unknown|ok|degraded)$/)
    });
    expect(typeof response.body.uptime_seconds).toBe("number");
    expect(typeof response.body.timestamp).toBe("string");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("groq health endpoint classifies success", async () => {
    const originalKey = config.groqApiKey;
    config.groqApiKey = "test-secret";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 })));

    const response = await request(createApp()).get("/health/groq").expect(200);

    expect(response.body).toMatchObject({ groq: "ok", model: expect.any(String), latency_ms: expect.any(Number) });
    config.groqApiKey = originalKey;
  });

  it("groq health endpoint classifies 429 without leaking key", async () => {
    const originalKey = config.groqApiKey;
    config.groqApiKey = "super-secret-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })));

    const response = await request(createApp()).get("/health/groq").expect(503);
    const serialized = JSON.stringify(response.body);

    expect(response.body).toMatchObject({ groq: "degraded", error_type: "groq_429" });
    expect(serialized).not.toContain("super-secret-key");
    config.groqApiKey = originalKey;
  });

  it("telegram webhook responds immediately while processing async", async () => {
    const app = express();
    const handleUpdate = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const bot = {
      telegram: { setWebhook: vi.fn(async () => true) },
      handleUpdate
    };
    await registerWebhook(app, bot as never, { ...config, botPublicUrl: "https://example.test" });

    await request(app).post(TELEGRAM_WEBHOOK_PATH).send({ update_id: 1 }).expect(200);

    expect(bot.telegram.setWebhook).toHaveBeenCalledWith("https://example.test/telegram/webhook");
    expect(handleUpdate).toHaveBeenCalledWith({ update_id: 1 });
  });
});

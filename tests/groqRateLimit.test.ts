import { afterEach, describe, expect, it, vi } from "vitest";
import { GroqClient, GroqError } from "../src/prometheus/groqClient.js";
import { PerUserRateLimiter } from "../src/telegram/rateLimiter.js";

describe("Groq error handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("detects 429 and does not retry immediately", async () => {
    const fetchMock = vi.fn(async () => new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GroqClient({ groqApiKey: "secret-key", groqModel: "test" }, 1000, 1);

    await expect(client.chat([{ role: "user", content: "hello" }])).rejects.toMatchObject({ type: "groq_429" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries non-429 failures once after a short delay", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "PROMETHEUS online." } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GroqClient({ groqApiKey: "secret-key", groqModel: "test" }, 1000, 1);

    await expect(client.chat([{ role: "user", content: "hello" }])).resolves.toBe("PROMETHEUS online.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("classifies invalid Groq responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })));
    const client = new GroqClient({ groqApiKey: "secret-key", groqModel: "test" }, 1000, 0);

    await expect(client.chat([{ role: "user", content: "hello" }])).rejects.toEqual(new GroqError("groq_invalid_response"));
  });
});

describe("Telegram per-user rate limiter", () => {
  it("allows owner 30 messages per minute", () => {
    const limiter = new PerUserRateLimiter();
    for (let index = 0; index < 30; index += 1) {
      expect(limiter.allow("owner", "owner", 1000)).toBe(true);
    }
    expect(limiter.allow("owner", "owner", 1000)).toBe(false);
  });

  it("allows trusted contacts 10 messages per minute", () => {
    const limiter = new PerUserRateLimiter();
    for (let index = 0; index < 10; index += 1) {
      expect(limiter.allow("trusted", "trusted_contact", 1000)).toBe(true);
    }
    expect(limiter.allow("trusted", "trusted_contact", 1000)).toBe(false);
  });

  it("allows public and pending users 3 messages per minute", () => {
    const limiter = new PerUserRateLimiter();
    for (let index = 0; index < 3; index += 1) {
      expect(limiter.allow("public", "user", 1000)).toBe(true);
    }
    expect(limiter.allow("public", "user", 1000)).toBe(false);
  });
});

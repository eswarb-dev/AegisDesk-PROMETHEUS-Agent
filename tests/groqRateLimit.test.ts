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

  it("attempts fallback model once after a primary network error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "fallback online" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GroqClient(
      { groqApiKey: "secret-key", groqModel: "primary", groqModelPrimary: "primary", groqModelFallback: "fallback" },
      1000,
      0
    );

    await expect(client.chat([{ role: "user", content: "hello" }])).resolves.toBe("fallback online");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).model).toBe("primary");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).model).toBe("fallback");
  });

  it("returns structured safe error status after model failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad gateway", { status: 502 })));
    const client = new GroqClient({ groqApiKey: "secret-key", groqModel: "primary" }, 1000, 0);

    await expect(client.chatWithStatus([{ role: "user", content: "hello" }])).resolves.toMatchObject({
      ok: false,
      errorType: "groq_network_error",
      fallbackUsed: true
    });
  });

  it("attempts fallback model after a primary invalid response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "model decommissioned" } }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "fallback model online" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GroqClient(
      { groqApiKey: "secret-key", groqModel: "old-model", groqModelPrimary: "old-model", groqModelFallback: "current-model" },
      1000,
      0
    );

    await expect(client.chat([{ role: "user", content: "hello" }])).resolves.toBe("fallback model online");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).model).toBe("current-model");
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

  it("allows trusted contacts 12 messages per minute", () => {
    const limiter = new PerUserRateLimiter();
    for (let index = 0; index < 12; index += 1) {
      expect(limiter.allow("trusted", "trusted_contact", 1000)).toBe(true);
    }
    expect(limiter.allow("trusted", "trusted_contact", 1000)).toBe(false);
  });

  it("allows public and pending users 4 messages per minute", () => {
    const limiter = new PerUserRateLimiter();
    for (let index = 0; index < 4; index += 1) {
      expect(limiter.allow("public", "user", 1000)).toBe(true);
    }
    expect(limiter.allow("public", "user", 1000)).toBe(false);
  });

  it("does not repeat cooldown notices within 30 seconds", () => {
    const limiter = new PerUserRateLimiter();

    expect(limiter.shouldNotifyCooldown("chat", 1000)).toBe(true);
    expect(limiter.shouldNotifyCooldown("chat", 20_000)).toBe(false);
    expect(limiter.shouldNotifyCooldown("chat", 32_000)).toBe(true);
  });

  it("trusted contact can send normal follow-up one minute later", () => {
    const limiter = new PerUserRateLimiter();

    expect(limiter.allow("trusted", "trusted_contact", 1000)).toBe(true);
    expect(limiter.allow("trusted", "trusted_contact", 61_000)).toBe(true);
  });
});

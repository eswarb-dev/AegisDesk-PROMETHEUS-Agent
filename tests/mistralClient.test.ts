import { afterEach, describe, expect, it, vi } from "vitest";
import { MistralClient } from "../src/mistral/mistralClient.js";

describe("Mistral coding client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("auth error does not call Mistral without an API key", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new MistralClient({ apiKey: undefined, model: "codestral-latest", timeoutMs: 1000, maxRetries: 1 });

    const result = await client.chat([{ role: "user", content: "reply ok" }]);

    expect(result).toMatchObject({ ok: false, errorType: "mistral_auth_error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("timeout retries once before returning safe error type", async () => {
    const timeout = new DOMException("timeout", "AbortError");
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout);
    vi.stubGlobal("fetch", fetchMock);
    const client = new MistralClient({ apiKey: "test-key", model: "codestral-latest", timeoutMs: 1000, maxRetries: 1 });

    const result = await client.chat([{ role: "user", content: "reply ok" }]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ ok: false, errorType: "mistral_timeout" });
  });

  it("valid Mistral response returns text without exposing key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "```python\nprint('ok')\n```" } }] })
    }));
    const client = new MistralClient({ apiKey: "secret-key", model: "codestral-latest", timeoutMs: 1000, maxRetries: 0 });

    const result = await client.chat([{ role: "user", content: "reply ok" }]);

    expect(result).toMatchObject({ ok: true, provider: "mistral", model: "codestral-latest", text: "```python\nprint('ok')\n```" });
    expect(JSON.stringify(result)).not.toContain("secret-key");
  });
});

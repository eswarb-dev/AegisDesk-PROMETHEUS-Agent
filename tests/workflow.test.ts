import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("GitHub keep-awake workflow", () => {
  it("pings only the Render health endpoint", async () => {
    const workflow = await readFile(".github/workflows/keep-prometheus-awake.yml", "utf8");

    expect(workflow).toContain("PROMETHEUS_RENDER_HEALTH_URL");
    expect(workflow).toContain("curl --fail --silent --show-error --max-time 25");
    expect(workflow).not.toContain("/telegram/webhook");
    expect(workflow).not.toContain("/health/groq");
  });
});

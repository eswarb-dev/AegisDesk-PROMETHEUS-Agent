import { describe, expect, it } from "vitest";
import { decideResponseMode } from "../src/prometheus/responseModeDecider.js";

describe("response mode decider", () => {
  it("routes trusted contact log question to fact retrieval", () => {
    expect(decideResponseMode("what did Vathanya ask you about me")).toMatchObject({
      mode: "FACT_RETRIEVAL_THEN_NATURAL_REPLY",
      contactId: "vathanya",
      asksAboutOwner: true
    });
  });

  it("routes chatted question to log query", () => {
    expect(decideResponseMode("does vathanya chatted with you")).toMatchObject({
      mode: "FACT_RETRIEVAL_THEN_NATURAL_REPLY",
      contactId: "vathanya"
    });
  });

  it("routes natural owner memory question to owner memory summary", () => {
    expect(decideResponseMode("what do you know about me").mode).toBe("OWNER_MEMORY_SUMMARY");
  });

  it("does not route owner storytelling with contact names to log retrieval", () => {
    const text = "while after college hours me vathanya and aksharaa entered elevator and aksharaa said eswarrr help which made me feel like protector";

    expect(decideResponseMode(text)).toMatchObject({ mode: "GROQ_CHAT" });
  });

  it("routes slash commands as deterministic commands", () => {
    expect(decideResponseMode("/memory").mode).toBe("DETERMINISTIC_COMMAND");
    expect(decideResponseMode("/logs vathanya").mode).toBe("DETERMINISTIC_COMMAND");
  });
});

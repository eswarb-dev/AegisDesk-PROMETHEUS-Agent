import { describe, expect, it } from "vitest";
import { decideResponseMode, decideTrustedContactResponseMode } from "../src/prometheus/responseModeDecider.js";

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

  it("routes short trusted-contact reactions after owner relay to contextual reply", () => {
    expect(decideTrustedContactResponseMode({
      text: "😭😭",
      recentContext: [
        {
          direction: "outbound",
          sender_role: "owner",
          sender_label: "owner_via_prometheus",
          message_type: "owner_relay",
          owner_initiated: true,
          contact_id: "vathanya",
          text: "Let me know a thing that you exposed my Creator's gf plan for his bday 😂😂"
        }
      ]
    }).mode).toBe("CONTEXTUAL_REPLY_TO_OWNER_RELAY");
  });

  it("keeps real distress text on support path even if prior owner relay exists", () => {
    expect(decideTrustedContactResponseMode({
      text: "I'm not okay, I feel alone",
      recentContext: [
        {
          direction: "outbound",
          owner_initiated: true,
          message_type: "owner_relay",
          text: "Hey, reply when free"
        }
      ]
    }).mode).toBe("TRUSTED_CONTACT_SUPPORT");
  });
});

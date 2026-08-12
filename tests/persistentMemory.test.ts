import { mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ShareIndexStore, type ShareIndexData } from "../src/memory/shareIndexStore.js";
import { UserMemoryStore } from "../src/memory/userMemoryStore.js";

async function userStore() {
  const dir = await mkdtemp(path.join(tmpdir(), "prometheus-users-"));
  const file = path.join(dir, "user_memories.json");
  await writeFile(file, JSON.stringify({ users: [] }, null, 2));
  return new UserMemoryStore(file);
}

async function shareStore(data: ShareIndexData) {
  const dir = await mkdtemp(path.join(tmpdir(), "prometheus-share-"));
  const file = path.join(dir, "eswar_share_index.json");
  await writeFile(file, JSON.stringify(data, null, 2));
  return new ShareIndexStore(file);
}

describe("persistent per-user memory", () => {
  it("creates user memory and updates safe conversation summary", async () => {
    const store = await userStore();
    await store.upsertIdentity({
      telegram_user_id: 2002,
      chat_id: 3003,
      role: "user",
      display_name: "Public User",
      username: "public"
    });
    await store.appendSafeSummary(2002, "I usually prefer short replies from Prometheus.");

    const memory = await store.get(2002);
    expect(memory?.conversation_summary).toContain("short replies");
    expect(memory?.safe_notes[0].visibility).toBe("self_only");
  });

  it("does not store secrets in user memory summaries", async () => {
    const store = await userStore();
    await store.upsertIdentity({
      telegram_user_id: 2002,
      chat_id: 3003,
      role: "user",
      display_name: "Public User"
    });
    await store.appendSafeSummary(2002, "My password is hunter2 and OTP is 123456.");

    const memory = await store.get(2002);
    expect(memory?.conversation_summary).toBe("");
    expect(memory?.safe_notes).toHaveLength(0);
  });

  it("forget deletes that user's stored memory", async () => {
    const store = await userStore();
    await store.upsertIdentity({
      telegram_user_id: 2002,
      chat_id: 3003,
      role: "user",
      display_name: "Public User"
    });

    expect(await store.forget(2002)).toBe(true);
    expect(await store.get(2002)).toBeUndefined();
  });
});

describe("Eswar share index", () => {
  it("filters by allowed contacts and expiry", async () => {
    const store = await shareStore({
      indexes: [
        {
          key: "allowed",
          summary: "Allowed for Aksharaa.",
          visibility: "trusted_contacts",
          allowed_contacts: ["aksharaa"],
          sensitivity: "low",
          source: "owner_approved",
          confidence: 1,
          expires_at: null,
          safe_answer_style: "warm",
          blocked_details: []
        },
        {
          key: "expired",
          summary: "Expired state.",
          visibility: "trusted_contacts",
          allowed_contacts: ["aksharaa"],
          sensitivity: "medium",
          source: "owner_approved",
          confidence: 1,
          expires_at: "2020-01-01T00:00:00.000Z",
          safe_answer_style: "warm",
          blocked_details: []
        }
      ]
    });

    expect((await store.listAllowed("trusted_contact", "aksharaa")).map((item) => item.key)).toEqual(["allowed"]);
    expect(await store.listAllowed("trusted_contact", "vathanya")).toHaveLength(0);
    expect(await store.listAllowed("user", null)).toHaveLength(0);
  });

  it("state memory has expiry and can be shared", async () => {
    const store = await shareStore({ indexes: [] });
    const state = await store.addState("Eswar is focused on AegisDesk and prefers calm support.");

    expect(state.expires_at).toBeTruthy();
    expect(state.visibility).toBe("owner_only");

    const shared = await store.share(state.key, "all");
    expect(shared.visibility).toBe("trusted_contacts");
    expect(shared.allowed_contacts).toContain("vathanya");
  });

  it("seeds README-derived Eswar share profiles", async () => {
    const store = await shareStore({ indexes: [] });

    await store.seedDefaultProfiles();
    const allowed = await store.listAllowed("trusted_contact", "aksharaa");
    const publicItems = await store.listAllowed("user", null);

    expect(allowed.map((item) => item.key)).toContain("eswar_general_profile");
    expect(allowed.map((item) => item.key)).toContain("eswar_project_focus");
    expect(allowed.map((item) => item.key)).toContain("eswar_emotional_bridge");
    expect(publicItems.map((item) => item.key)).toEqual(["eswar_boundaries"]);
  });
});

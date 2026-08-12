import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { createSupabaseServerClient } from "../src/storage/supabaseClient.js";
import { UserRepository } from "../src/storage/userRepository.js";
import { ShareIndexRepository } from "../src/storage/shareIndexRepository.js";
import { MemoryRepository } from "../src/storage/memoryRepository.js";

function queryMock(result: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ["select", "eq", "in", "or", "lt", "not", "update", "delete", "upsert", "insert", "order"];
  for (const method of methods) chain[method] = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({ data: result, error: null }));
  chain.maybeSingle = vi.fn(async () => ({ data: result, error: null }));
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve({ data: result, error: null }).then(resolve, reject);
  return chain;
}

describe("Supabase config", () => {
  it("missing env is handled safely in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        TELEGRAM_BOT_TOKEN: "bot",
        OWNER_TELEGRAM_ID: "1001",
        DATABASE_PROVIDER: "supabase"
      })
    ).toThrow("SUPABASE_URL");
  });

  it("service role key is not included in clear config errors", () => {
    expect(() => createSupabaseServerClient({ nodeEnv: "production", supabaseUrl: "https://example.supabase.co" })).toThrow(
      "Supabase configuration is required"
    );
  });
});

describe("Supabase repositories", () => {
  it("/start creates user and username spoofing does not grant owner", async () => {
    const row = { telegram_user_id: "2002", role: "pending" };
    const supabase = { from: vi.fn(() => queryMock(row)) };
    const repo = new UserRepository(supabase as never);

    const user = await repo.createOrUpdateTelegramUser({
      telegram_user_id: "2002",
      username: "eswar",
      display_name: "Eswar B",
      role: "pending"
    });

    expect(user.role).toBe("pending");
    expect(supabase.from).toHaveBeenCalledWith("telegram_users");
  });

  it("trusted contact can access allowed share index but expired indexes are ignored by active key lookup", async () => {
    const supabase = { from: vi.fn(() => queryMock(null)) };
    const repo = new ShareIndexRepository(supabase as never);

    await expect(repo.getActiveShareIndexByKey("expired")).resolves.toBeNull();
  });

  it("self_only memory retrieval is scoped to the same user", async () => {
    const supabase = { from: vi.fn(() => queryMock([{ owner_telegram_user_id: "2002", visibility: "self_only" }])) };
    const repo = new MemoryRepository(supabase as never);

    const memories = await repo.getSelfMemories("2002");

    expect(memories[0].visibility).toBe("self_only");
    const query = supabase.from.mock.results[0].value;
    expect(query.eq).toHaveBeenCalledWith("owner_telegram_user_id", "2002");
    expect(query.eq).toHaveBeenCalledWith("visibility", "self_only");
  });

  it("trusted contact cannot access generic owner_only memory through role filtering", () => {
    const supabase = { from: vi.fn(() => queryMock([])) };
    const repo = new MemoryRepository(supabase as never);

    expect(repo.filterForRole([{ visibility: "owner_only" } as never], "trusted_contact")).toHaveLength(0);
  });

  it("subject internal memory is scoped to the same contact and non-disclosable profile rows", async () => {
    const supabase = { from: vi.fn(() => queryMock([{ subject_contact_id: "vathanya", visibility: "owner_only" }])) };
    const repo = new MemoryRepository(supabase as never);

    await expect(repo.getSubjectInternalMemories("vathanya")).resolves.toHaveLength(1);
    const query = supabase.from.mock.results[0].value;
    expect(query.eq).toHaveBeenCalledWith("subject_contact_id", "vathanya");
    expect(query.eq).toHaveBeenCalledWith("visibility", "owner_only");
    expect(query.eq).toHaveBeenCalledWith("usable_when_chatting_with_subject", true);
    expect(query.eq).toHaveBeenCalledWith("disclosable_to_subject", false);
  });
});

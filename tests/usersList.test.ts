import { describe, expect, it, vi } from "vitest";
import { buildUsersResponse, dedupeUsers } from "../src/commands/usersList.js";
import type { TelegramUserRow } from "../src/storage/userRepository.js";

const ownerTelegramId = "1001";

const users: TelegramUserRow[] = [
  {
    telegram_user_id: "1001",
    display_name: "Eswar B",
    role: "owner",
    chat_id: "1001",
    memory_enabled: true,
    created_at: "2026-08-11T22:22:00Z",
    updated_at: "2026-08-12T03:52:00Z",
    last_seen_at: "2026-08-12T03:52:00Z"
  },
  {
    telegram_user_id: "2002",
    display_name: "Aksharaa",
    role: "trusted_contact",
    contact_id: "aksharaa",
    chat_id: null,
    memory_enabled: true,
    created_at: "2026-08-11T04:46:00Z",
    updated_at: "2026-08-11T05:00:00Z",
    last_seen_at: "2026-08-11T05:00:00Z"
  },
  {
    telegram_user_id: "2002",
    display_name: "Aksharaa AK",
    role: "pending",
    contact_id: null,
    chat_id: "2002",
    memory_enabled: true,
    created_at: "2026-08-10T04:46:00Z",
    updated_at: "2026-08-12T05:00:00Z",
    last_seen_at: "2026-08-12T05:00:00Z"
  },
  {
    telegram_user_id: "3003",
    display_name: "Test",
    role: "owner",
    chat_id: "3003",
    approved: false,
    memory_enabled: true,
    created_at: "2026-08-11T04:46:00Z",
    updated_at: "2026-08-11T04:46:00Z",
    last_seen_at: "2026-08-11T04:46:00Z"
  },
  {
    telegram_user_id: "4004",
    display_name: "Pending User",
    role: "pending",
    chat_id: "4004",
    memory_enabled: true,
    created_at: "2026-08-11T04:46:00Z",
    updated_at: "2026-08-11T04:46:00Z",
    last_seen_at: "2026-08-11T04:46:00Z"
  }
];

function stats() {
  return new Map([
    ["1001", { telegram_user_id: "1001", total: 42, inbound: 21, outbound: 21, latest_message_at: new Date(Date.now() - 2 * 60_000).toISOString() }],
    ["2002", { telegram_user_id: "2002", total: 18, inbound: 9, outbound: 9, latest_message_at: new Date(Date.now() - 60 * 60_000).toISOString() }]
  ]);
}

describe("PROMETHEUS /users list", () => {
  it("collapses duplicate telegram_user_id rows and preserves useful fields", () => {
    const deduped = dedupeUsers(users, ownerTelegramId, stats());

    expect(deduped.filter((user) => user.telegram_user_id === "2002")).toHaveLength(1);
    const aksharaa = deduped.find((user) => user.telegram_user_id === "2002");
    expect(aksharaa).toMatchObject({
      role: "trusted_contact",
      contact_id: "aksharaa",
      chat_id: "2002",
      created_at: "2026-08-10T04:46:00Z",
      last_seen_at: "2026-08-12T05:00:00Z"
    });
  });

  it("corrects invalid stored owner role unless id matches owner id", () => {
    const output = buildUsersResponse({ users, stats: stats(), ownerTelegramId, timezone: "Asia/Kolkata", mode: "detail" });

    expect(output).toContain("1. Eswar B");
    expect(output).toContain("role        owner");
    expect(output).toContain("warning     invalid_owner_role_corrected");
    expect(output).not.toMatch(/Test\nrole        owner/);
  });

  it("shows timestamps, latest message, message count, and no raw logs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T04:00:00Z"));
    const output = buildUsersResponse({ users, stats: stats(), ownerTelegramId, timezone: "Asia/Kolkata", mode: "all" });
    vi.useRealTimers();

    expect(output).toContain("first seen");
    expect(output).toContain("last seen");
    expect(output).toContain("last msg");
    expect(output).toContain("messages    42");
    expect(output).not.toContain("Hey Vathanya");
  });

  it("filters trusted and pending variants", () => {
    const trusted = buildUsersResponse({ users, stats: stats(), ownerTelegramId, mode: "trusted" });
    expect(trusted).toContain("contact     aksharaa");
    expect(trusted).not.toContain("Pending User");

    const pending = buildUsersResponse({ users, stats: stats(), ownerTelegramId, mode: "pending" });
    expect(pending).toContain("Pending User");
    expect(pending).not.toContain("Aksharaa");
  });

  it("reports duplicates in diagnostic mode", () => {
    const output = buildUsersResponse({ users, ownerTelegramId, mode: "duplicates" });

    expect(output).toContain("PROMETHEUS User Duplicates");
    expect(output).toContain("telegram 2002");
    expect(output).toContain("records  2");
  });
});

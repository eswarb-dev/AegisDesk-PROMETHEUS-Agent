import { mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { TrustedContactService, isAllowedContactId } from "../src/contacts/trustedContactService.js";
import { TrustedContactStore } from "../src/contacts/trustedContactStore.js";
import type { TrustedContactsData } from "../src/contacts/trustedContactTypes.js";

const baseData: TrustedContactsData = {
  trusted_contacts: [
    {
      id: "aksharaa",
      name: "Aksharaa",
      telegram_user_id: null,
      chat_id: null,
      username: null,
      enabled: false,
      role: "trusted_contact",
      permissions: {
        receive_agent_messages: true,
        receive_wellbeing_updates: true,
        ask_about_eswar: true,
        access_trusted_memory: true,
        access_owner_memory: false
      },
      created_at: null,
      approved_at: null,
      last_seen: null
    },
    {
      id: "vathanya",
      name: "Vathanya",
      telegram_user_id: null,
      chat_id: null,
      username: null,
      enabled: false,
      role: "trusted_contact",
      permissions: {
        receive_agent_messages: true,
        receive_wellbeing_updates: true,
        ask_about_eswar: true,
        access_trusted_memory: true,
        access_owner_memory: false
      },
      created_at: null,
      approved_at: null,
      last_seen: null
    },
    {
      id: "maddhurika",
      name: "Maddhurika",
      telegram_user_id: null,
      chat_id: null,
      username: null,
      enabled: false,
      role: "trusted_contact",
      permissions: {
        receive_agent_messages: true,
        receive_wellbeing_updates: true,
        ask_about_eswar: true,
        access_trusted_memory: true,
        access_owner_memory: false
      },
      created_at: null,
      approved_at: null,
      last_seen: null
    }
  ],
  pending_users: []
};

async function tempStore() {
  const dir = await mkdtemp(path.join(tmpdir(), "prometheus-contacts-"));
  const file = path.join(dir, "trusted_contacts.json");
  await import("node:fs/promises").then((fs) => fs.writeFile(file, `${JSON.stringify(baseData, null, 2)}\n`));
  return { file, store: new TrustedContactStore(file) };
}

describe("trusted contact store", () => {
  it("unknown Telegram ID is user until approved and username spoofing is ignored", async () => {
    const { store } = await tempStore();
    const service = new TrustedContactService({ ownerTelegramId: "1001" }, store);

    expect(await service.resolveRole(2002)).toMatchObject({ role: "user" });
    await service.registerPending({
      telegram_user_id: 2002,
      chat_id: 2002,
      username: "aksharaa",
      display_name: "Aksharaa",
      role: "pending",
      trusted: false,
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    });
    expect(await service.resolveRole(2002)).toMatchObject({ role: "user" });
  });

  it("trusted mapping persists after restart and disabled contacts lose access", async () => {
    const { file, store } = await tempStore();
    const service = new TrustedContactService({ ownerTelegramId: "1001" }, store);
    await service.registerPending({
      telegram_user_id: 2222,
      chat_id: 3333,
      username: "friend",
      display_name: "Friend",
      role: "pending",
      trusted: false,
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString()
    });
    await service.approve(2222, "aksharaa");

    const restarted = new TrustedContactService({ ownerTelegramId: "1001" }, new TrustedContactStore(file));
    expect(await restarted.resolveRole(2222)).toMatchObject({ role: "trusted_contact" });

    await restarted.revoke("aksharaa");
    expect(await restarted.resolveRole(2222)).toMatchObject({ role: "user" });
    expect(await readFile(file, "utf8")).toContain("\"enabled\": false");
  });

  it("validates contact IDs", () => {
    expect(isAllowedContactId("aksharaa")).toBe(true);
    expect(isAllowedContactId("admin")).toBe(false);
  });
});

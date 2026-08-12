import { describe, expect, it, vi } from "vitest";
import { adminCommand } from "../src/commands/admin.js";
import { helpCommand } from "../src/commands/help.js";
import { chatCommand } from "../src/commands/adminLogs.js";
import { supportOffCommand } from "../src/commands/support.js";
import { startCommand } from "../src/commands/start.js";
import { trustCommand } from "../src/commands/trust.js";
import { untrustCommand } from "../src/commands/untrust.js";
import { MemoryStore } from "../src/memory/memoryStore.js";
import {
  OWNER_COMMANDS,
  PUBLIC_COMMANDS,
  TRUSTED_CONTACT_COMMANDS,
  refreshCommandMenuForUser
} from "../src/telegram/commandMenu.js";
import { createMockContext } from "./helpers.js";

const config = { ownerTelegramId: "1001" };

function withTelegram(ctx: ReturnType<typeof createMockContext>) {
  const setMyCommands = vi.fn().mockResolvedValue(true);
  return Object.assign(ctx, {
    telegram: {
      setMyCommands,
      sendMessage: vi.fn()
    }
  });
}

describe("role-based command menus", () => {
  it("public command menu contains only public commands", () => {
    expect(PUBLIC_COMMANDS.map((command) => command.command)).toEqual(["start", "help", "about", "ping", "privacy", "forgetme", "whoami"]);
    expect(PUBLIC_COMMANDS.some((command) => command.command === "logs")).toBe(false);
  });

  it("trusted contact menu contains trusted commands", () => {
    expect(TRUSTED_CONTACT_COMMANDS.map((command) => command.command)).toContain("supportoff");
    expect(TRUSTED_CONTACT_COMMANDS.map((command) => command.command)).not.toContain("chat");
  });

  it("owner menu is compact and omits detailed log commands", () => {
    const commands = OWNER_COMMANDS.map((command) => command.command);
    expect(commands).toEqual(["start", "help", "about", "ping", "whoami", "memory", "contacts", "admin", "support"]);
    expect(commands).not.toContain("logs");
    expect(commands).not.toContain("chat");
    expect(commands).not.toContain("export");
  });

  it("/admin shows logs memory contact and support groups", async () => {
    const ctx = createMockContext({ userId: 1001, text: "/admin" });

    await adminCommand(ctx, config);

    expect(ctx.replies[0]).toContain("Logs:");
    expect(ctx.replies[0]).toContain("Memory:");
    expect(ctx.replies[0]).toContain("Contacts:");
    expect(ctx.replies[0]).toContain("Support:");
  });

  it("/help public hides owner commands", async () => {
    const ctx = createMockContext({ userId: 2002, text: "/help" });

    await helpCommand(ctx, config);

    expect(ctx.replies[0]).toContain("PROMETHEUS Commands");
    expect(ctx.replies[0]).not.toContain("/admin");
    expect(ctx.replies[0]).not.toContain("/logs");
  });

  it("/help owner sections are owner-restricted", async () => {
    const ownerHelpCtx = createMockContext({ userId: 1001, text: "/help owner" });
    await helpCommand(ownerHelpCtx, config);
    expect(ownerHelpCtx.replies[0]).toContain("/memory summary");

    const publicCtx = createMockContext({ userId: 2002, text: "/help logs" });
    await helpCommand(publicCtx, config);
    expect(publicCtx.replies[0]).toContain("owner-restricted");

    const ownerCtx = createMockContext({ userId: 1001, text: "/help logs" });
    await helpCommand(ownerCtx, config);
    expect(ownerCtx.replies[0]).toContain("/chat <contact_id>");
  });

  it("/help contacts and /help support are visible only to owner", async () => {
    const contactsCtx = createMockContext({ userId: 1001, text: "/help contacts" });
    await helpCommand(contactsCtx, config);
    expect(contactsCtx.replies[0]).toContain("/trust <telegram_user_id> <contact_id>");

    const supportCtx = createMockContext({ userId: 1001, text: "/help support" });
    await helpCommand(supportCtx, config);
    expect(supportCtx.replies[0]).toContain("/support alerts");

    const publicCtx = createMockContext({ userId: 2002, text: "/help support" });
    await helpCommand(publicCtx, config);
    expect(publicCtx.replies[0]).toContain("owner-restricted");
  });

  it("/help trusted is visible to trusted contact and owner", async () => {
    const contacts = { resolveRole: vi.fn().mockResolvedValue({ role: "trusted_contact" }) };
    const trustedCtx = createMockContext({ userId: 2002, text: "/help trusted" });
    await helpCommand(trustedCtx, config, contacts as never);
    expect(trustedCtx.replies[0]).toContain("/supportoff");

    const ownerCtx = createMockContext({ userId: 1001, text: "/help trusted" });
    await helpCommand(ownerCtx, config, contacts as never);
    expect(ownerCtx.replies[0]).toContain("Trusted Contact Commands");
  });

  it("refreshCommandMenuForUser selects the role menu", async () => {
    const telegram = { setMyCommands: vi.fn().mockResolvedValue(true) };

    await refreshCommandMenuForUser(telegram as never, { role: "owner", chat_id: "1" });
    await refreshCommandMenuForUser(telegram as never, { role: "trusted_contact", chat_id: "2" });
    await refreshCommandMenuForUser(telegram as never, { role: "pending", chat_id: "3" });

    expect(telegram.setMyCommands.mock.calls[0][0].map((command: { command: string }) => command.command)).toContain("admin");
    expect(telegram.setMyCommands.mock.calls[1][0].map((command: { command: string }) => command.command)).toContain("supportoff");
    expect(telegram.setMyCommands.mock.calls[2][0].map((command: { command: string }) => command.command)).not.toContain("supportoff");
  });

  it("/start registers a role menu", async () => {
    const store = new MemoryStore();
    const ctx = withTelegram(createMockContext({ userId: 1001, text: "/start" }));

    await startCommand(ctx, config, store);

    expect(ctx.telegram.setMyCommands).toHaveBeenCalled();
    expect(ctx.telegram.setMyCommands.mock.calls[0][0].map((command: { command: string }) => command.command)).toContain("admin");
  });

  it("/trust refreshes trusted contact menu", async () => {
    const ctx = withTelegram(createMockContext({ userId: 1001, text: "/trust 2002 aksharaa" }));
    const service = {
      approve: async () => ({ id: "aksharaa", name: "Aksharaa", chat_id: 2002 })
    };

    await trustCommand(ctx, config, service as never);

    expect(ctx.telegram.setMyCommands).toHaveBeenCalled();
    expect(ctx.telegram.setMyCommands.mock.calls[0][0].map((command: { command: string }) => command.command)).toContain("supportoff");
  });

  it("/untrust refreshes menu back to public", async () => {
    const ctx = withTelegram(createMockContext({ userId: 1001, text: "/untrust aksharaa" }));
    const service = {
      list: async () => ({ trusted_contacts: [{ id: "aksharaa", chat_id: 2002 }], pending_users: [] }),
      revoke: async () => ({ id: "aksharaa", name: "Aksharaa" })
    };

    await untrustCommand(ctx, config, service as never);

    expect(ctx.telegram.setMyCommands).toHaveBeenCalled();
    expect(ctx.telegram.setMyCommands.mock.calls[0][0].map((command: { command: string }) => command.command)).not.toContain("supportoff");
  });

  it("trusted contact manually typing /chat is rejected", async () => {
    const ctx = createMockContext({ userId: 2002, text: "/chat aksharaa" });

    await chatCommand(ctx, config, { kind: "supabase" } as never);

    expect(ctx.replies[0]).toContain("owner-restricted");
  });

  it("/supportoff only works for trusted contacts", async () => {
    const publicCtx = createMockContext({ userId: 2002, text: "/supportoff" });
    const storage = {
      kind: "supabase",
      users: {
        getTelegramUserById: vi.fn().mockResolvedValue({ telegram_user_id: "2002", role: "user" }),
        createOrUpdateTelegramUser: vi.fn()
      }
    };

    await supportOffCommand(publicCtx, storage as never);
    expect(publicCtx.replies[0]).toContain("approved trusted contacts");

    const trustedCtx = createMockContext({ userId: 3003, text: "/supportoff" });
    storage.users.getTelegramUserById.mockResolvedValueOnce({ telegram_user_id: "3003", role: "trusted_contact", chat_id: "3003", contact_id: "vathanya" });

    await supportOffCommand(trustedCtx, storage as never);
    expect(trustedCtx.replies[0]).toContain("Support memory is now off");
    expect(storage.users.createOrUpdateTelegramUser).toHaveBeenCalled();
  });
});

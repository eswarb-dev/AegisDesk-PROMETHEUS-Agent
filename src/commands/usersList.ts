import type { AppConfig } from "../config.js";
import type { UserRole } from "../memory/memoryTypes.js";
import type { UserMessageStats } from "../storage/messageRepository.js";
import type { TelegramUserRow } from "../storage/userRepository.js";

export type UsersMode = "active" | "all" | "trusted" | "pending" | "detail" | "duplicates";

type UserWithStats = TelegramUserRow & {
  duplicate_count?: number;
  invalid_owner_corrected?: boolean;
  message_stats?: UserMessageStats;
};

const ROLE_PRIORITY: Record<UserRole, number> = {
  owner: 0,
  trusted_contact: 1,
  pending: 2,
  user: 3
};

export function parseUsersMode(text: string): UsersMode {
  const mode = text.trim().split(/\s+/)[1]?.toLowerCase();
  if (mode === "all" || mode === "trusted" || mode === "pending" || mode === "detail" || mode === "duplicates") return mode;
  return "active";
}

export function buildUsersResponse(input: {
  users: TelegramUserRow[];
  stats?: Map<string, UserMessageStats>;
  ownerTelegramId: string;
  timezone?: string;
  mode?: UsersMode;
}): string {
  const timezone = input.timezone || "UTC";
  const mode = input.mode ?? "active";
  const deduped = dedupeUsers(input.users, input.ownerTelegramId, input.stats);
  if (mode === "duplicates") return formatDuplicates(input.users, input.ownerTelegramId, timezone);
  let users = deduped;
  if (mode === "trusted") users = users.filter((user) => user.role === "trusted_contact");
  if (mode === "pending") users = users.filter((user) => user.role === "pending");
  if (mode === "active") users = users.filter((user) => user.role === "owner" || user.role === "trusted_contact" || (user.message_stats?.total ?? 0) > 0);
  users = sortUsers(users);
  if (!users.length) return "PROMETHEUS Users\n\nTotal users: 0";
  return [
    "PROMETHEUS Users",
    "",
    `Total users: ${users.length}`,
    "",
    ...users.map((user, index) => formatUser(user, index + 1, timezone, mode === "detail"))
  ].join("\n");
}

export function dedupeUsers(users: TelegramUserRow[], ownerTelegramId: string, stats?: Map<string, UserMessageStats>): UserWithStats[] {
  const byId = new Map<string, UserWithStats>();
  for (const raw of users) {
    const user = normalizeRole(raw, ownerTelegramId);
    const existing = byId.get(String(user.telegram_user_id));
    if (!existing) {
      byId.set(String(user.telegram_user_id), { ...user, duplicate_count: 1, message_stats: stats?.get(String(user.telegram_user_id)) });
      continue;
    }
    byId.set(String(user.telegram_user_id), mergeUsers(existing, user, stats?.get(String(user.telegram_user_id))));
  }
  return [...byId.values()];
}

function mergeUsers(left: UserWithStats, right: UserWithStats, stats?: UserMessageStats): UserWithStats {
  const role = ROLE_PRIORITY[right.role] < ROLE_PRIORITY[left.role] ? right.role : left.role;
  const latest = isAfter(right.updated_at, left.updated_at) ? right : left;
  return {
    ...left,
    ...latest,
    telegram_user_id: left.telegram_user_id,
    role,
    contact_id: latest.contact_id ?? left.contact_id ?? right.contact_id ?? null,
    chat_id: latest.chat_id ?? left.chat_id ?? right.chat_id ?? null,
    username: latest.username ?? left.username ?? right.username ?? null,
    display_name: latest.display_name ?? left.display_name ?? right.display_name ?? null,
    memory_enabled: latest.memory_enabled ?? left.memory_enabled ?? right.memory_enabled,
    created_at: earliest(left.created_at, right.created_at),
    last_seen_at: latestDate(left.last_seen_at, right.last_seen_at),
    updated_at: latestDate(left.updated_at, right.updated_at),
    duplicate_count: (left.duplicate_count ?? 1) + 1,
    invalid_owner_corrected: left.invalid_owner_corrected || right.invalid_owner_corrected,
    message_stats: stats ?? left.message_stats
  };
}

function normalizeRole(user: TelegramUserRow, ownerTelegramId: string): TelegramUserRow & { invalid_owner_corrected?: boolean } {
  if (user.role === "owner" && String(user.telegram_user_id) !== String(ownerTelegramId)) {
    return { ...user, role: user.approved ? "trusted_contact" : "user", invalid_owner_corrected: true };
  }
  if (String(user.telegram_user_id) === String(ownerTelegramId)) return { ...user, role: "owner" };
  return user;
}

function formatUser(user: UserWithStats, index: number, timezone: string, detail: boolean): string {
  const stats = user.message_stats;
  const lines = [
    `${index}. ${user.display_name || user.username || "Telegram user"}`,
    `role        ${user.role}`,
    `telegram    ${user.telegram_user_id}`,
    `chat        ${user.chat_id ? "available" : "missing"}`,
    `contact     ${user.contact_id ?? "-"}`,
    `first seen  ${formatDate(user.created_at, timezone)}`,
    `last seen   ${formatDate(user.last_seen_at, timezone)}`,
    `last msg    ${stats?.latest_message_at ? relativeTime(stats.latest_message_at) : "none"}`,
    `messages    ${stats?.total ?? 0}`,
    `memory      ${user.memory_enabled === false ? "disabled" : "enabled"}`
  ];
  if (detail) {
    lines.push(`inbound     ${stats?.inbound ?? 0}`);
    lines.push(`outbound    ${stats?.outbound ?? 0}`);
    lines.push(`duplicates  ${user.duplicate_count ?? 1}`);
    if (user.invalid_owner_corrected) lines.push("warning     invalid_owner_role_corrected");
  }
  return lines.join("\n");
}

function formatDuplicates(users: TelegramUserRow[], ownerTelegramId: string, timezone: string): string {
  const groups = new Map<string, TelegramUserRow[]>();
  for (const user of users) {
    const list = groups.get(String(user.telegram_user_id)) ?? [];
    list.push(normalizeRole(user, ownerTelegramId));
    groups.set(String(user.telegram_user_id), list);
  }
  const duplicates = [...groups.entries()].filter(([, list]) => list.length > 1);
  if (!duplicates.length) return "PROMETHEUS User Duplicates\n\nNo duplicate telegram_user_id records found.";
  return [
    "PROMETHEUS User Duplicates",
    "",
    ...duplicates.map(([id, list]) => [
      `telegram ${id}`,
      `records  ${list.length}`,
      ...list.map((user) => `- ${user.display_name ?? user.username ?? "unknown"} role=${user.role} created=${formatDate(user.created_at, timezone)} last_seen=${formatDate(user.last_seen_at, timezone)}`)
    ].join("\n"))
  ].join("\n\n");
}

function sortUsers(users: UserWithStats[]): UserWithStats[] {
  return [...users].sort((a, b) => {
    const roleDelta = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];
    if (roleDelta !== 0) return roleDelta;
    return new Date(b.last_seen_at ?? 0).getTime() - new Date(a.last_seen_at ?? 0).getTime();
  });
}

function formatDate(value: string | null | undefined, timezone: string): string {
  if (!value) return "unknown";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(value));
}

function relativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  if (diff < 60_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function isAfter(a?: string | null, b?: string | null): boolean {
  return new Date(a ?? 0).getTime() > new Date(b ?? 0).getTime();
}

function earliest(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
}

function latestDate(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

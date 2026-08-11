import type { Context } from "telegraf";

export function createMockContext(options: {
  userId: number;
  chatId?: number;
  text?: string;
  username?: string;
  firstName?: string;
}): Context & { replies: string[] } {
  const replies: string[] = [];
  return {
    from: {
      id: options.userId,
      is_bot: false,
      first_name: options.firstName ?? "Test",
      username: options.username
    },
    chat: {
      id: options.chatId ?? options.userId,
      type: "private",
      first_name: options.firstName ?? "Test",
      username: options.username
    },
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: options.chatId ?? options.userId, type: "private" },
      from: { id: options.userId, is_bot: false, first_name: options.firstName ?? "Test" },
      text: options.text ?? ""
    },
    replies,
    reply: async (text: string) => {
      replies.push(text);
      return undefined as never;
    }
  } as unknown as Context & { replies: string[] };
}

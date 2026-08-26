import type { PendingCodingRequest } from "./codingTypes.js";

const TEN_MINUTES_MS = 10 * 60 * 1000;

export class PendingCodingRequestRepository {
  private readonly requests = new Map<string, PendingCodingRequest>();

  save(input: {
    userId: string | number;
    chatId: string | number;
    originalProblem: string;
    parsedExamples: PendingCodingRequest["parsedExamples"];
    parsedConstraints: string[];
    detectedOutputStyle: PendingCodingRequest["detectedOutputStyle"];
    now?: Date;
  }): PendingCodingRequest {
    const now = input.now ?? new Date();
    const request: PendingCodingRequest = {
      userId: String(input.userId),
      chatId: String(input.chatId),
      originalProblem: input.originalProblem,
      parsedExamples: input.parsedExamples,
      parsedConstraints: input.parsedConstraints,
      detectedOutputStyle: input.detectedOutputStyle,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TEN_MINUTES_MS).toISOString()
    };
    this.requests.set(this.key(input.userId, input.chatId), request);
    return request;
  }

  get(userId: string | number, chatId: string | number, now = new Date()): PendingCodingRequest | null {
    const key = this.key(userId, chatId);
    const request = this.requests.get(key);
    if (!request) return null;
    if (new Date(request.expiresAt).getTime() <= now.getTime()) {
      this.requests.delete(key);
      return null;
    }
    return request;
  }

  clear(userId: string | number, chatId: string | number): void {
    this.requests.delete(this.key(userId, chatId));
  }

  private key(userId: string | number, chatId: string | number): string {
    return `${userId}:${chatId}`;
  }
}

export const pendingCodingRequests = new PendingCodingRequestRepository();

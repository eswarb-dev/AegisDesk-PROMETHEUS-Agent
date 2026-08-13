import { buildMimeMessage, encodeBase64Url } from "./gmailMimeBuilder.js";
import { refreshAccessToken } from "./gmailOAuth.js";
import type { GmailDraftConfig, GmailDraftResult, GmailDraftSummary, GmailSendResult, MailDraftInput } from "./gmailTypes.js";

export class GmailApiError extends Error {
  constructor(readonly reason: "drafts_disabled" | "draft_create_failed" | "draft_delete_failed" | "draft_list_failed" | "draft_send_failed") {
    super(reason);
    this.name = "GmailApiError";
  }
}

export class GmailClient {
  constructor(private readonly config: GmailDraftConfig) {}

  async createDraft(input: MailDraftInput): Promise<GmailDraftResult> {
    if (!this.config.gmailDraftsEnabled) throw new GmailApiError("drafts_disabled");
    const accessToken = await refreshAccessToken(this.config);
    const mime = buildMimeMessage({
      ...input,
      fromEmail: this.config.gmailSenderEmail,
      fromName: this.config.gmailSenderName
    });
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message: { raw: encodeBase64Url(mime) } })
    });
    const body = await response.json() as { id?: string; message?: { id?: string }; error?: { message?: string } };
    if (!response.ok || !body.id) throw new GmailApiError("draft_create_failed");
    return { id: body.id, messageId: body.message?.id };
  }

  async deleteDraft(draftId: string): Promise<void> {
    if (!this.config.gmailDraftsEnabled) throw new GmailApiError("drafts_disabled");
    const accessToken = await refreshAccessToken(this.config);
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new GmailApiError("draft_delete_failed");
  }

  async listDrafts(limit = 10): Promise<GmailDraftSummary[]> {
    if (!this.config.gmailDraftsEnabled) throw new GmailApiError("drafts_disabled");
    const accessToken = await refreshAccessToken(this.config);
    const maxResults = Math.max(1, Math.min(25, limit));
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=${maxResults}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const body = await response.json() as { drafts?: Array<{ id?: string; message?: { id?: string } }> };
    if (!response.ok) throw new GmailApiError("draft_list_failed");
    const draftIds = (body.drafts ?? []).map((draft) => draft.id).filter((id): id is string => Boolean(id));
    const drafts = await Promise.all(draftIds.map((draftId) => this.getDraftSummary(accessToken, draftId)));
    return drafts
      .filter((draft): draft is GmailDraftSummary => Boolean(draft))
      .sort((a, b) => (b.internalDate ?? 0) - (a.internalDate ?? 0))
      .slice(0, maxResults);
  }

  async sendDraft(draftId: string): Promise<GmailSendResult> {
    if (!this.config.gmailDraftsEnabled) throw new GmailApiError("drafts_disabled");
    const accessToken = await refreshAccessToken(this.config);
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const body = await response.json() as { id?: string };
    if (!response.ok || !body.id) throw new GmailApiError("draft_send_failed");
    return { draftId, messageId: body.id };
  }

  private async getDraftSummary(accessToken: string, draftId: string): Promise<GmailDraftSummary | null> {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}?format=metadata&metadataHeaders=To&metadataHeaders=Subject`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const body = await response.json() as {
      id?: string;
      message?: {
        id?: string;
        snippet?: string;
        internalDate?: string;
        payload?: { headers?: Array<{ name?: string; value?: string }> };
      };
    };
    if (!response.ok || !body.id) return null;
    const headers = body.message?.payload?.headers ?? [];
    return {
      id: body.id,
      messageId: body.message?.id,
      subject: headerValue(headers, "Subject"),
      to: headerValue(headers, "To"),
      snippet: body.message?.snippet,
      internalDate: body.message?.internalDate ? Number(body.message.internalDate) : undefined
    };
  }
}

function headerValue(headers: Array<{ name?: string; value?: string }>, name: string): string | undefined {
  return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value;
}

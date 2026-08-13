import { buildMimeMessage, encodeBase64Url } from "./gmailMimeBuilder.js";
import { refreshAccessToken } from "./gmailOAuth.js";
import type { GmailDraftConfig, GmailDraftResult, MailDraftInput } from "./gmailTypes.js";

export class GmailClient {
  constructor(private readonly config: GmailDraftConfig) {}

  async createDraft(input: MailDraftInput): Promise<GmailDraftResult> {
    if (!this.config.gmailDraftsEnabled) throw new Error("Gmail drafts are disabled");
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
    if (!response.ok || !body.id) throw new Error(body.error?.message ?? "Unable to create Gmail draft");
    return { id: body.id, messageId: body.message?.id };
  }

  async deleteDraft(draftId: string): Promise<void> {
    if (!this.config.gmailDraftsEnabled) throw new Error("Gmail drafts are disabled");
    const accessToken = await refreshAccessToken(this.config);
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/drafts/${encodeURIComponent(draftId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error("Unable to discard Gmail draft");
  }
}

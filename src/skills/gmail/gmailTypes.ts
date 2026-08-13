export type GmailDraftConfig = {
  googleClientId?: string;
  googleClientSecret?: string;
  googleRedirectUri?: string;
  gmailRefreshToken?: string;
  gmailSenderEmail: string;
  gmailSenderName: string;
  gmailDraftsEnabled: boolean;
};

export type MailDraftInput = {
  to: string[];
  subject: string;
  body: string;
};

export type GmailDraftRecord = {
  id?: string;
  gmail_draft_id: string;
  owner_telegram_user_id: string;
  to_email: string;
  subject: string;
  body_preview?: string | null;
  status: "created" | "discarded" | "sent";
  created_by_command?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GmailDraftResult = {
  id: string;
  messageId?: string;
};

export type GmailDraftSummary = {
  id: string;
  messageId?: string;
  subject?: string;
  to?: string;
  snippet?: string;
  internalDate?: number;
};

export type GmailSendResult = {
  draftId: string;
  messageId?: string;
};

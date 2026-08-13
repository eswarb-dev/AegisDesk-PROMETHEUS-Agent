import type { MailDraftInput } from "./gmailTypes.js";

export type MailPolicyResult = { ok: true } | { ok: false; reason: string };

const emailPattern = /^[^\s@|<>]+@[^\s@|<>]+\.[^\s@|<>]+$/;

export function validateDraftInput(input: MailDraftInput): MailPolicyResult {
  if (!input.to.length) return { ok: false, reason: "recipient email is required" };
  if (input.to.length > 5) return { ok: false, reason: "maximum 5 recipients allowed in Phase 1" };
  if (input.to.some((email) => !emailPattern.test(email))) return { ok: false, reason: "invalid recipient email" };
  if (!input.subject.trim()) return { ok: false, reason: "subject is required" };
  if (!input.body.trim()) return { ok: false, reason: "body is required" };
  const combined = `${input.subject}\n${input.body}`.toLowerCase();
  if (/\bbcc\s*:|hidden recipients?|blast|bulk mail|mass mail|unsubscribe\b/.test(combined)) return { ok: false, reason: "mass mailing is not allowed" };
  if (/\bpassword|otp|one[-\s]?time password|seed phrase|private key|login here|verify your account|bank account|credit card\b/.test(combined)) return { ok: false, reason: "unsafe email content" };
  if (/\bmalware|payload|keylogger|phishing|credential collection|harass|threaten\b/.test(combined)) return { ok: false, reason: "unsafe email content" };
  if (/\bpretend to be|impersonate|from ceo|from bank|official notice from\b/.test(combined)) return { ok: false, reason: "impersonation content is not allowed" };
  return { ok: true };
}

export function parseRecipients(value: string): string[] {
  return value.split(",").map((email) => email.trim()).filter(Boolean);
}

export function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "[invalid-email]";
  return `${local.slice(0, 2)}***@${domain}`;
}

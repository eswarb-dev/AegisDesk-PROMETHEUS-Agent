import type { MailDraftInput } from "./gmailTypes.js";

export function buildMimeMessage(input: MailDraftInput & { fromEmail: string; fromName: string }): string {
  const headers = [
    `From: ${formatAddress(input.fromName, input.fromEmail)}`,
    `To: ${input.to.join(", ")}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit"
  ];
  return `${headers.join("\r\n")}\r\n\r\n${input.body}`;
}

export function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function formatAddress(name: string, email: string): string {
  const safeName = name.replace(/["\r\n]/g, "");
  return `${safeName} <${email}>`;
}

function encodeHeader(value: string): string {
  return value.replace(/\r?\n/g, " ").trim();
}

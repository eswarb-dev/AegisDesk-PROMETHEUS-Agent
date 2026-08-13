import type { MailDraftInput } from "./gmailTypes.js";

export const prometheusMailSignature = [
  "PROMETHEUS",
  "Personalised Agent to Eswar B",
  "AEGISDESK // AGENT SYSTEM",
  "",
  "Always listening. Always learning. Always there."
].join("\n");

export function buildMimeMessage(input: MailDraftInput & { fromEmail: string; fromName: string }): string {
  const boundary = `prometheus_${Date.now().toString(36)}`;
  const plainBody = withPrometheusSignature(input.body);
  const htmlBody = buildHtmlBody(input.body);
  const headers = [
    `From: ${formatAddress(input.fromName, input.fromEmail)}`,
    `To: ${input.to.join(", ")}`,
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  return [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    plainBody,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    htmlBody,
    `--${boundary}--`
  ].join("\r\n");
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

function withPrometheusSignature(body: string): string {
  const cleanBody = body.trimEnd();
  if (hasPrometheusSignature(cleanBody)) return cleanBody;
  return `${cleanBody}\n\n${prometheusMailSignature}`;
}

function buildHtmlBody(body: string): string {
  const cleanBody = stripExistingSignature(body.trimEnd());
  const bodyHtml = textToHtml(cleanBody);
  const spacer = bodyHtml ? "<br><br>" : "";
  return [
    bodyHtml,
    spacer,
    '<div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.45;">',
    '<strong>PROMETHEUS</strong><br>',
    '<em>Personalised Agent to Eswar B</em><br>',
    '<strong>AEGISDESK // AGENT SYSTEM</strong><br><br>',
    '<span style="font-family: Consolas, Menlo, monospace;">Always listening. Always learning. Always there.</span>',
    "</div>"
  ].join("");
}

function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripExistingSignature(body: string): string {
  if (!hasPrometheusSignature(body)) return body;
  return body.slice(0, body.indexOf("PROMETHEUS")).trimEnd();
}

function hasPrometheusSignature(body: string): boolean {
  return body.includes("PROMETHEUS") && body.includes("AEGISDESK // AGENT SYSTEM");
}

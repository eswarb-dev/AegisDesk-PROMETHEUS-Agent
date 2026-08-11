const SECRET_PATTERNS: RegExp[] = [
  /\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gi,
  /\b(?:sk|pk|sb|gsk)_[A-Za-z0-9_-]{20,}\b/g,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(password|passcode|api key|secret|token)\s*[:=]\s*\S+/gi,
  /\b(otp|code|password)\D{0,16}\d{4,8}\b/gi
];

export function redactSecrets(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  return SECRET_PATTERNS.reduce((value, pattern) => value.replace(pattern, "[REDACTED_SECRET]"), text);
}

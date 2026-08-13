import type { GmailDraftConfig } from "./gmailTypes.js";

export const gmailComposeScope = "https://www.googleapis.com/auth/gmail.compose";

export class GmailOAuthError extends Error {
  constructor(
    readonly reason: "missing_config" | "token_refresh_failed" | "code_exchange_failed",
    readonly googleErrorCode?: string
  ) {
    super(reason);
    this.name = "GmailOAuthError";
  }
}

export type GmailOAuthDiagnostic = {
  ok: boolean;
  googleErrorCode?: string;
};

export function buildGoogleOAuthUrl(config: Pick<GmailDraftConfig, "googleClientId" | "googleRedirectUri">): string {
  if (!config.googleClientId || !config.googleRedirectUri) throw new Error("Google OAuth client ID and redirect URI are required");
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: gmailComposeScope
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForRefreshToken(config: Pick<GmailDraftConfig, "googleClientId" | "googleClientSecret" | "googleRedirectUri">, code: string): Promise<string> {
  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) throw new GmailOAuthError("missing_config");
  const response = await postOAuthToken({
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: config.googleRedirectUri,
    grant_type: "authorization_code",
    code
  }, "code_exchange_failed");
  const body = await readOAuthJson(response);
  if (!response.ok || !body.refresh_token) throw new GmailOAuthError("code_exchange_failed", sanitizeGoogleErrorCode(body.error));
  return body.refresh_token;
}

export async function refreshAccessToken(config: Pick<GmailDraftConfig, "googleClientId" | "googleClientSecret" | "gmailRefreshToken">): Promise<string> {
  if (!config.googleClientId || !config.googleClientSecret || !config.gmailRefreshToken) throw new GmailOAuthError("missing_config");
  const response = await postOAuthToken({
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    refresh_token: config.gmailRefreshToken,
    grant_type: "refresh_token"
  }, "token_refresh_failed");
  const body = await readOAuthJson(response);
  if (!response.ok || !body.access_token) throw new GmailOAuthError("token_refresh_failed", sanitizeGoogleErrorCode(body.error));
  return body.access_token;
}

export async function checkGmailOAuth(config: Pick<GmailDraftConfig, "googleClientId" | "googleClientSecret" | "gmailRefreshToken">): Promise<GmailOAuthDiagnostic> {
  try {
    await refreshAccessToken(config);
    return { ok: true };
  } catch (error) {
    if (error instanceof GmailOAuthError) return { ok: false, googleErrorCode: error.googleErrorCode };
    return { ok: false };
  }
}

async function readOAuthJson(response: Response): Promise<{ access_token?: string; refresh_token?: string; error?: string }> {
  try {
    return await response.json() as { access_token?: string; refresh_token?: string; error?: string };
  } catch {
    return {};
  }
}

async function postOAuthToken(body: Record<string, string>, failureReason: "token_refresh_failed" | "code_exchange_failed"): Promise<Response> {
  try {
    return await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body)
    });
  } catch {
    throw new GmailOAuthError(failureReason, "network_error");
  }
}

function sanitizeGoogleErrorCode(error: unknown): string | undefined {
  if (typeof error !== "string") return undefined;
  return /^[a-z0-9_]+$/i.test(error) ? error : undefined;
}

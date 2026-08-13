import type { GmailDraftConfig } from "./gmailTypes.js";

export const gmailComposeScope = "https://www.googleapis.com/auth/gmail.compose";

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
  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
    throw new Error("Google OAuth client ID, client secret, and redirect URI are required");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: config.googleRedirectUri,
      grant_type: "authorization_code",
      code
    })
  });
  const body = await response.json() as { refresh_token?: string; error?: string };
  if (!response.ok || !body.refresh_token) throw new Error(body.error ?? "Unable to exchange code for refresh token");
  return body.refresh_token;
}

export async function refreshAccessToken(config: Pick<GmailDraftConfig, "googleClientId" | "googleClientSecret" | "gmailRefreshToken">): Promise<string> {
  if (!config.googleClientId || !config.googleClientSecret || !config.gmailRefreshToken) {
    throw new Error("Gmail OAuth is not configured");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: config.gmailRefreshToken,
      grant_type: "refresh_token"
    })
  });
  const body = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !body.access_token) throw new Error(body.error ?? "Unable to refresh Gmail access token");
  return body.access_token;
}

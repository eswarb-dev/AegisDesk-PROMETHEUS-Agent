import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import { buildGoogleOAuthUrl, exchangeCodeForRefreshToken, gmailComposeScope } from "../src/skills/gmail/gmailOAuth.js";

dotenv.config();

async function main(): Promise<void> {
  const config = {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI
  };
  const authUrl = buildGoogleOAuthUrl(config);
  console.log("Open this URL and sign in as prometheus.inference@gmail.com:");
  console.log(authUrl);
  console.log("");
  console.log(`Scope: ${gmailComposeScope}`);
  const rl = createInterface({ input, output });
  const code = await rl.question("Paste authorization code: ");
  rl.close();
  const refreshToken = await exchangeCodeForRefreshToken(config, code.trim());
  console.log("");
  console.log("Add this to Render env vars. Do not commit it:");
  console.log(`GMAIL_REFRESH_TOKEN=${refreshToken}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "OAuth setup failed");
  process.exit(1);
});

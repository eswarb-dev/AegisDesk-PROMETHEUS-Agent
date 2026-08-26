import type { Request } from "express";
import type { AppConfig } from "../config.js";

export function isDesktopAgentRequestAuthorized(req: Request, config: AppConfig): boolean {
  const configured = config.desktopAgentSharedSecret;
  if (!configured) return false;

  const authorization = req.header("authorization") ?? "";
  const bearerPrefix = "Bearer ";
  const bearer = authorization.startsWith(bearerPrefix) ? authorization.slice(bearerPrefix.length).trim() : "";
  const direct = req.header("x-desktop-agent-secret") ?? "";

  return constantTimeEquals(bearer, configured) || constantTimeEquals(direct, configured);
}

function constantTimeEquals(left: string, right: string): boolean {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

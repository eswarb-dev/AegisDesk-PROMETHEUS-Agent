import type express from "express";
import type { AppConfig } from "../config.js";
import { DesktopReplyService } from "../prometheus/desktopReplyService.js";
import { isDesktopAgentRequestAuthorized } from "../security/desktopAgentAuth.js";

export function registerDesktopReplyRoute(app: express.Express, config: AppConfig): void {
  app.post("/api/prometheus/desktop-reply", async (req, res) => {
    if (!isDesktopAgentRequestAuthorized(req, config)) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const body = req.body;
    if (!body || body.source !== "aegisdesk_desktop_voice" || typeof body.text !== "string") {
      res.status(400).json({ ok: false, error: "invalid_request" });
      return;
    }

    const service = new DesktopReplyService(config);
    const reply = await service.buildReply(body);
    res.json(reply);
  });
}

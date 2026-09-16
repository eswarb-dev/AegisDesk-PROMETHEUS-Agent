import { logger } from "../utils/logger.js";

export type OwnerSupportAlertContext = {
  type: "trusted_support";
  contactId: string;
  telegramUserId: string;
  createdAt: string;
  alertId?: string;
};

let lastOwnerAlert: OwnerSupportAlertContext | null = null;

export function recordOwnerSupportAlert(context: OwnerSupportAlertContext): void {
  lastOwnerAlert = context;
  if (process.env.NODE_ENV === "development") {
    logger.info("support_alert_context_recorded", {
      support_alert_id: context.alertId,
      contact_id: context.contactId,
      telegram_user_id: context.telegramUserId,
      created_at: context.createdAt
    });
  }
}

export function getRecentOwnerSupportAlert(now = Date.now(), windowMs = 30 * 60 * 1000): OwnerSupportAlertContext | null {
  if (!lastOwnerAlert) return null;
  const createdAt = new Date(lastOwnerAlert.createdAt).getTime();
  if (!Number.isFinite(createdAt) || now - createdAt > windowMs) return null;
  return lastOwnerAlert;
}

export function isOwnerAlertFollowup(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();
  return /^(who|who was that|which one|who asked|which trusted contact|which contact|who is that|who was it)$/.test(normalized);
}

export function formatContactDisplayName(contactId: string): string {
  return contactId.charAt(0).toUpperCase() + contactId.slice(1);
}
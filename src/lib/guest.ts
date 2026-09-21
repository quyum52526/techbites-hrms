/**
 * Guest (read-only) mode configuration.
 *
 * - GUEST_COMPANY_ID: the one company a guest may browse. Guest mode is off while it is unset or unknown.
 * - GUEST_MODE_ENABLED: must be "true" in production; development always allows guests (given a company).
 */

export const GUEST_SESSION_MAX_AGE_SECONDS = 4 * 60 * 60;

export const guestCompanyId = () => process.env.GUEST_COMPANY_ID?.trim() || null;

export function guestModeEnabled() {
  const allowed = process.env.NODE_ENV !== "production" || process.env.GUEST_MODE_ENABLED === "true";
  return allowed && guestCompanyId() !== null;
}

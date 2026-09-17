import type { AttendanceStatus } from "@prisma/client";

/** Organization timezone: Asia/Dhaka is a fixed UTC+6 with no daylight saving. */
export const ORG_UTC_OFFSET_MINUTES = 6 * 60;
const OFFSET_MS = ORG_UTC_OFFSET_MINUTES * 60_000;

export const DEFAULT_SHIFT_POLICY = { startTime: "09:00", graceMinutes: 15 };

/**
 * `AttendanceRecord.date` is a Postgres DATE, stored as UTC midnight of the org-local calendar day.
 * Using this instead of server-local midnight keeps dates identical on a Dhaka laptop and a UTC server.
 */
export function orgDateOf(instant: Date): Date {
  const local = new Date(instant.getTime() + OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

export const orgToday = () => orgDateOf(new Date());

/** Seconds since org-local midnight. */
export function orgSecondsOfDay(instant: Date): number {
  const local = new Date(instant.getTime() + OFFSET_MS);
  return local.getUTCHours() * 3600 + local.getUTCMinutes() * 60 + local.getUTCSeconds();
}

// Shared time part: groups 4-8 are hour, minute, second, AM/PM, zone.
const TIME_PART = String.raw`[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(AM|PM)?\s*(Z|[+-]\d{2}:?\d{2})?$`;
/** Year first — ISO / standard: groups 1-3 are year, month, day. */
const YEAR_FIRST_PATTERN = new RegExp(String.raw`^(\d{4})[-/](\d{1,2})[-/](\d{1,2})` + TIME_PART, "i");
/** Day first — Bangladeshi biometric devices: groups 1-3 are day, month, year. */
const DAY_FIRST_PATTERN = new RegExp(String.raw`^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})` + TIME_PART, "i");

/**
 * Parses device punch timestamps. Two date orders are accepted, told apart by where the 4-digit year sits:
 * - year first (ISO / standard): "2026-09-17 09:05:12", "2026/09/17 9:05 AM", "2026-09-17T03:05:12Z"
 * - day first (Bangladeshi biometric devices): "17/09/2026 09:05:12", "17-09-2026 9:05 PM", "17.09.2026 09:05"
 * Month-first US dates (09/17/2026) are not supported; they are rejected when the "month" exceeds 12.
 * Timestamps without a zone are device-local, i.e. organization time.
 */
export function parsePunchTimestamp(raw: string): Date | null {
  const input = raw.trim();
  let year: number, month: number, day: number;
  let match = YEAR_FIRST_PATTERN.exec(input);
  if (match) {
    [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = DAY_FIRST_PATTERN.exec(input);
    if (!match) return null;
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }

  const [, , , , h, mi, s, meridiem, zone] = match;
  let hour = Number(h);
  const minute = Number(mi);
  const second = s ? Number(s) : 0;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem.toUpperCase() === "PM" ? 12 : 0);
  }
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;

  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  // Reject rollovers like 2026-02-30.
  if (new Date(wallClockUtc).getUTCDate() !== day) return null;

  let offsetMinutes = ORG_UTC_OFFSET_MINUTES;
  if (zone && zone.toUpperCase() === "Z") {
    offsetMinutes = 0;
  } else if (zone) {
    const sign = zone.startsWith("-") ? -1 : 1;
    const digits = zone.slice(1).replace(":", "");
    offsetMinutes = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2)));
  }

  return new Date(wallClockUtc - offsetMinutes * 60_000);
}

/** Punching in after `startTime + graceMinutes` counts as LATE, matching the Settings page policy text. */
export function evaluateCheckInStatus(
  checkIn: Date,
  policy: { startTime: string; graceMinutes: number }
): Extract<AttendanceStatus, "PRESENT" | "LATE"> {
  const [startHour, startMinute] = policy.startTime.split(":").map(Number);
  const lateAfterSeconds = (startHour * 60 + startMinute + policy.graceMinutes) * 60;
  return orgSecondsOfDay(checkIn) > lateAfterSeconds ? "LATE" : "PRESENT";
}

import type { EmployeeStatus } from "@prisma/client";
import { orgDateOf } from "@/lib/attendance-time";

export const employeeStatusLabels: Record<EmployeeStatus, string> = {
  ACTIVE: "Active",
  PROBATION: "Probation",
  NOTICE_PERIOD: "Notice period",
  TERMINATED: "Terminated",
  RESIGNED: "Resigned",
};

export const employeeStatusBadgeClass: Record<EmployeeStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  PROBATION: "bg-amber-50 text-amber-800",
  NOTICE_PERIOD: "bg-orange-50 text-orange-800",
  TERMINATED: "bg-rose-50 text-rose-700",
  RESIGNED: "bg-slate-100 text-slate-700",
};

/** Statuses set only by processing a release, which also stores the final settlement. */
export const SEPARATED_STATUSES: EmployeeStatus[] = ["TERMINATED", "RESIGNED"];

export const isSeparated = (status: EmployeeStatus) => SEPARATED_STATUSES.includes(status);

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

/** Longest side, in pixels, that uploaded images are resized to in the browser. The NID scan stays readable. */
export const PHOTO_MAX_PX = 512;
export const NID_SCAN_MAX_PX = 1600;

/** Org-local (Asia/Dhaka) calendar day as a YYYY-MM-DD date input value. */
export const toDateInputValue = (date: Date) => orgDateOf(date).toISOString().slice(0, 10);

/** Accepts a site-relative path (/uploads/photo.jpg) or an absolute http(s) URL; anything else (javascript:, data:, //host) is rejected. */
export function isSafeAssetUrl(value: string) {
  if (value.length > 2048) return false;
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

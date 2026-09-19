import type { LeaveStatus } from "@prisma/client";

/*
 * Leave labels and balance types shared by server pages and client components. Kept free of Prisma runtime imports
 * so client bundles can use it.
 */

export const PENDING_LEAVE_STATUSES: LeaveStatus[] = ["PENDING_TL", "PENDING_MANAGER", "PENDING_HR"];

export const leaveStatusLabels: Record<LeaveStatus, string> = {
  PENDING_TL: "Pending TL",
  PENDING_MANAGER: "Pending Manager",
  PENDING_HR: "Pending HR",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const leaveStatusBadgeClass = (status: LeaveStatus) =>
  status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : status === "REJECTED" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700";

export type LeaveTypeBalance = { leaveTypeId: string; name: string; quota: number; used: number; remaining: number };

/** EXHAUSTED: some quota is fully used. LOW: some quota is at 20% or less. */
export type BalanceStatus = "ON_TRACK" | "LOW" | "EXHAUSTED";

export const balanceStatusLabels: Record<BalanceStatus, string> = { ON_TRACK: "On Track", LOW: "Low Balance", EXHAUSTED: "Exhausted" };

export const balanceStatusBadgeClass: Record<BalanceStatus, string> = {
  ON_TRACK: "bg-emerald-50 text-emerald-700",
  LOW: "bg-amber-50 text-amber-700",
  EXHAUSTED: "bg-rose-50 text-rose-700",
};

export function balanceStatus(balances: LeaveTypeBalance[]): BalanceStatus {
  const limited = balances.filter((b) => b.quota > 0);
  if (limited.some((b) => b.remaining <= 0)) return "EXHAUSTED";
  if (limited.some((b) => b.remaining / b.quota <= 0.2)) return "LOW";
  return "ON_TRACK";
}

/** One leave request as shown in the history dialog; dates are ISO yyyy-mm-dd so they cross the server boundary. */
export type LeaveHistoryEntry = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  /** Who last approved or rejected it (the latest stage actor), if anyone has acted yet. */
  lastActionBy: string | null;
};

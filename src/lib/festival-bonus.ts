import type { FestivalBonusBasis } from "@prisma/client";
import type { PayrollPeriod } from "@/lib/payroll";

/*
 * Festival bonus rules. Pure functions with only type imports, so server pages and client components share them.
 */

export type FestivalBonusPolicyView = {
  companyId: string;
  year: number;
  targetBasis: FestivalBonusBasis;
  /** e.g. 50 = 50% of the basis. */
  percentage: number;
  /** Payroll months (1–12) the bonus is paid in, e.g. the two Eid months. */
  payoutMonths: number[];
  enabled: boolean;
};

export type FestivalBonus = { amount: number; label: string };

export const FESTIVAL_BONUS_BASIS_LABELS: Record<FestivalBonusBasis, string> = {
  BASIC: "Basic Salary",
  TOTAL_EARNINGS: "Total Earnings",
};

/** Upper bound accepted for the percentage (two months' worth), to catch typos like 500. */
export const MAX_FESTIVAL_BONUS_PERCENTAGE = 200;

export const MONTH_SHORT_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const round2 = (value: number) => Math.round(value * 100) / 100;

/** "50%", "12.5%": no trailing zeros. */
const formatPercent = (value: number) => `${Number(value.toFixed(2))}%`;

/** Badge text for the formula, e.g. "50% of Basic" or "25% of Total". */
export const festivalBonusFormula = (policy: Pick<FestivalBonusPolicyView, "percentage" | "targetBasis">) =>
  `${formatPercent(policy.percentage)} of ${policy.targetBasis === "BASIC" ? "Basic" : "Total"}`;

/** Whether the policy pays a bonus in the given payroll month. */
export function isActiveForMonth(policy: FestivalBonusPolicyView | null | undefined, period: PayrollPeriod): policy is FestivalBonusPolicyView {
  return !!policy && policy.enabled && policy.percentage > 0 && policy.year === period.year && policy.payoutMonths.includes(period.month);
}

/**
 * The festival bonus for one employee in one payroll month, or null when the policy does not pay this month.
 * BASIC: basicSalary × %. TOTAL_EARNINGS: regular gross (basic + allowances, before the bonus) × %.
 */
export function festivalBonusFor(
  policy: FestivalBonusPolicyView | null | undefined,
  period: PayrollPeriod,
  pay: { basicSalary: number; regularEarnings: number }
): FestivalBonus | null {
  if (!isActiveForMonth(policy, period)) return null;
  const base = policy.targetBasis === "BASIC" ? pay.basicSalary : pay.regularEarnings;
  return { amount: round2(Math.max(0, base) * (policy.percentage / 100)), label: festivalBonusFormula(policy) };
}

/** e.g. "Mar, Jun". */
export const payoutMonthsLabel = (months: number[]) =>
  [...months].sort((a, b) => a - b).map((month) => MONTH_SHORT_NAMES[month - 1]).join(", ");

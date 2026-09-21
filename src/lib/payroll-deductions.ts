/*
 * One-off payroll deductions (advance recovery, demurrage claims) and the register's pay totals.
 * Pure functions, shared by the payroll page, the deduction dialog's live preview and the server actions.
 */

/** Largest single deduction accepted, to catch a mistyped amount (e.g. an extra zero). */
export const MAX_DEDUCTION_AMOUNT = 10_000_000;
export const MAX_DEDUCTION_REMARKS = 500;

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Parses a money amount typed by a person or found in a CSV: blank means 0; "৳", commas and spaces are ignored.
 * Negative, non-numeric and absurdly large amounts are rejected.
 */
export function parseDeductionAmount(raw: string | null | undefined, label: string): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = (raw ?? "").replace(/[৳,\s]/g, "");
  if (cleaned === "") return { ok: true, value: 0 };
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return { ok: false, error: `${label} must be a number` };
  if (value < 0) return { ok: false, error: `${label} cannot be negative` };
  if (value > MAX_DEDUCTION_AMOUNT) return { ok: false, error: `${label} is above the ${MAX_DEDUCTION_AMOUNT.toLocaleString("en-IN")} limit` };
  return { ok: true, value: round2(value) };
}

/**
 * The register's totals for one employee:
 *   gross           = regular gross + festival bonus
 *   totalDeductions = base deductions (tax, PF, unpaid absence) + advance deduction + demurrage claim
 *   net             = gross − totalDeductions, never below 0
 */
export function payrollTotals(pay: {
  regularGross: number;
  festivalBonus: number;
  baseDeductions: number;
  advanceDeduction: number;
  demurrageClaim: number;
}) {
  const gross = round2(pay.regularGross + pay.festivalBonus);
  const totalDeductions = round2(pay.baseDeductions + pay.advanceDeduction + pay.demurrageClaim);
  return { gross, totalDeductions, net: round2(Math.max(0, gross - totalDeductions)) };
}

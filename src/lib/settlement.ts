import { PAYROLL_POLICY } from "@/lib/payroll";

/**
 * Full & final settlement on release, per the Bangladesh Labour Act 2006.
 * Pure and client-safe: the calculator previews with it and the release action recomputes with it,
 * so a stored settlement never trusts totals sent from the browser.
 */
export const SETTLEMENT_POLICY = {
  /** Section 26: wages in lieu of 120 days' notice when the employer terminates a monthly-rated worker. */
  noticePayDays: 120,
  /** Section 26: days of basic per year of service on termination. */
  terminationDaysPerYear: 30,
  /** Section 26: a trailing part-year of at least this many months counts as a full year. */
  partYearRoundUpMonths: 6,
  /** Section 27 resignation tiers, highest first: days of basic per completed year once `minYears` is reached. */
  resignationTiers: [
    { minYears: 10, daysPerYear: 30 },
    { minYears: 5, daysPerYear: 14 },
  ],
} as const;

export type SeparationKind = "TERMINATED" | "RESIGNED";

export type SettlementInput = {
  /** YYYY-MM-DD */
  joiningDate: string;
  /** YYYY-MM-DD */
  releaseDate: string;
  separationType: SeparationKind;
  basicSalary: number;
  includeNoticePay: boolean;
  includeServiceBenefit: boolean;
  unusedLeaveDays: number;
  unpaidSalaryDays: number;
  deductions: number;
};

/** What the calculator sends to process a release; the joining date always comes from the employee record. */
export type ReleaseInput = Omit<SettlementInput, "joiningDate">;

export type ServiceLength = {
  /** Calendar days from joining to release. */
  totalDays: number;
  /** Full anniversaries of the joining date reached by the release date. */
  completedYears: number;
  /** Full months after the last anniversary (0–11). */
  remainingMonths: number;
  /** Days after the last full month. */
  remainingDays: number;
};

export type ServiceBenefitRule = {
  /** Years the benefit is paid for. */
  years: number;
  /** Days of basic paid per year; 0 when the rule pays nothing. */
  daysPerYear: number;
  /** Plain-language statement of the rule that applied. */
  description: string;
};

export type SettlementBreakdown = ServiceLength & {
  dailyBasic: number;
  /** Notice pay only applies when the company terminated the employee. */
  noticePayApplied: boolean;
  noticePay: number;
  serviceBenefitRule: ServiceBenefitRule;
  serviceBenefit: number;
  leaveEncashment: number;
  unpaidSalary: number;
  deductions: number;
  grossPayable: number;
  netPayable: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const roundMoney = (value: number) => Math.round(value * 100) / 100;
const daysInMonth = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

/** Parses a YYYY-MM-DD date input as UTC midnight; null for anything else, including impossible dates like 2026-02-30. */
export function parseDateInput(value: string | null | undefined): Date | null {
  const match = DATE_PATTERN.exec(value?.trim() ?? "");
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

/**
 * Service measured on the calendar, not in 365-day blocks, so leap years never make a year "complete" a day early —
 * which matters at the 5- and 10-year resignation thresholds. A month is complete once its day-of-month is reached
 * (clamped to short months: a 31 Jan joiner completes a month on 28/29 Feb).
 */
export function serviceLength(joining: Date, release: Date): ServiceLength {
  if (release <= joining) return { totalDays: 0, completedYears: 0, remainingMonths: 0, remainingDays: 0 };

  const monthsBetween = (release.getUTCFullYear() - joining.getUTCFullYear()) * 12 + (release.getUTCMonth() - joining.getUTCMonth());
  const anchorFor = (months: number) => {
    const year = joining.getUTCFullYear() + Math.floor((joining.getUTCMonth() + months) / 12);
    const monthIndex = (joining.getUTCMonth() + months) % 12;
    return new Date(Date.UTC(year, monthIndex, Math.min(joining.getUTCDate(), daysInMonth(year, monthIndex))));
  };
  const totalMonths = anchorFor(monthsBetween) <= release ? monthsBetween : monthsBetween - 1;

  return {
    totalDays: Math.round((release.getTime() - joining.getTime()) / DAY_MS),
    completedYears: Math.floor(totalMonths / 12),
    remainingMonths: totalMonths % 12,
    remainingDays: Math.round((release.getTime() - anchorFor(totalMonths).getTime()) / DAY_MS),
  };
}

/**
 * Section 26 (terminated): 30 days per completed year, plus one year when the remaining part-year is 6+ months.
 * Section 27 (resigned): completed years only — under 5 years nothing, 5 to under 10 years 14 days, 10+ years 30 days.
 */
export function serviceBenefitRule(separationType: SeparationKind, service: ServiceLength): ServiceBenefitRule {
  const { completedYears, remainingMonths } = service;

  if (separationType === "TERMINATED") {
    const roundUp = remainingMonths >= SETTLEMENT_POLICY.partYearRoundUpMonths;
    const years = completedYears + (roundUp ? 1 : 0);
    return {
      years,
      daysPerYear: SETTLEMENT_POLICY.terminationDaysPerYear,
      description: `Section 26: ${SETTLEMENT_POLICY.terminationDaysPerYear} days × ${years} yr${
        roundUp ? ` (${completedYears} completed + 1 for ${remainingMonths} months)` : ""
      }`,
    };
  }

  const tier = SETTLEMENT_POLICY.resignationTiers.find((t) => completedYears >= t.minYears);
  if (!tier) {
    return { years: completedYears, daysPerYear: 0, description: "Section 27: under 5 completed years of service, no service benefit" };
  }
  return {
    years: completedYears,
    daysPerYear: tier.daysPerYear,
    description: `Section 27: ${tier.daysPerYear} days × ${completedYears} completed yr (${tier.minYears}+ years of service)`,
  };
}

export function calculateSettlement(input: SettlementInput): SettlementBreakdown {
  const joining = parseDateInput(input.joiningDate);
  const release = parseDateInput(input.releaseDate);
  const service = joining && release
    ? serviceLength(joining, release)
    : { totalDays: 0, completedYears: 0, remainingMonths: 0, remainingDays: 0 };
  const rule = serviceBenefitRule(input.separationType, service);

  const basicSalary = Math.max(0, input.basicSalary || 0);
  const dailyBasic = basicSalary / PAYROLL_POLICY.dayRateDivisor;

  const noticePayApplied = input.separationType === "TERMINATED" && input.includeNoticePay;
  const noticePay = noticePayApplied ? roundMoney(dailyBasic * SETTLEMENT_POLICY.noticePayDays) : 0;
  const serviceBenefit = input.includeServiceBenefit ? roundMoney(rule.years * rule.daysPerYear * dailyBasic) : 0;
  const leaveEncashment = roundMoney(Math.max(0, input.unusedLeaveDays || 0) * dailyBasic);
  const unpaidSalary = roundMoney(Math.max(0, input.unpaidSalaryDays || 0) * dailyBasic);
  const deductions = roundMoney(Math.max(0, input.deductions || 0));

  const grossPayable = roundMoney(noticePay + serviceBenefit + leaveEncashment + unpaidSalary);

  return {
    ...service,
    dailyBasic: roundMoney(dailyBasic),
    noticePayApplied,
    noticePay,
    serviceBenefitRule: rule,
    serviceBenefit,
    leaveEncashment,
    unpaidSalary,
    deductions,
    grossPayable,
    netPayable: roundMoney(grossPayable - deductions),
  };
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, ChevronDown, UserX } from "lucide-react";
import { clsx } from "clsx";
import { releaseEmployee } from "@/app/actions/employees";
import FormField from "@/components/ui/FormField";
import { ConfirmModal } from "@/components/ui/Modal";
import { cardClass, controlClass, dangerButtonClass } from "@/components/ui/styles";
import { formatMoney } from "@/lib/payroll";
import { calculateSettlement, parseDateInput, SETTLEMENT_POLICY, type ReleaseInput, type SeparationKind } from "@/lib/settlement";

interface Props {
  employeeId: string;
  employeeName: string;
  /** YYYY-MM-DD, the official joining date from the employee profile. Shown read-only. */
  joiningDate: string;
  /** YYYY-MM-DD in org time, passed from the server so the first render matches on both sides. */
  today: string;
  /** Basic salary from the salary structure, when one exists. */
  initialBasicSalary: number | null;
}

const separationOptions: { value: SeparationKind; label: string; hint: string }[] = [
  { value: "TERMINATED", label: "Company Terminated", hint: "Employer ended the employment (Section 26)" },
  { value: "RESIGNED", label: "Employee Resigned", hint: "Employee left voluntarily (Section 27)" },
];

/** Dates from parseDateInput are UTC midnight, so format in UTC to keep the same calendar day. */
const formatDateInput = (date: Date) =>
  date.toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** Blank or invalid number inputs count as 0. */
const toNumber = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function BreakdownRow({ label, detail, value, tone }: { label: string; detail?: string; value: string; tone?: "negative" }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <dt className="text-slate-700">
        {label}
        {detail && <span className="block text-[11px] text-slate-500">{detail}</span>}
      </dt>
      <dd className={clsx("font-semibold tabular-nums whitespace-nowrap", tone === "negative" ? "text-rose-700" : "text-slate-900")}>
        {value}
      </dd>
    </div>
  );
}

/** Full & final settlement preview under the Bangladesh Labour Act, with a confirm step that processes the release. */
export default function ReleaseCalculator({ employeeId, employeeName, joiningDate, today, initialBasicSalary }: Props) {
  const router = useRouter();
  const [separationType, setSeparationType] = useState<SeparationKind>("TERMINATED");
  const [releaseDate, setReleaseDate] = useState(today);
  const [basicSalary, setBasicSalary] = useState(initialBasicSalary ? String(initialBasicSalary) : "");
  const [includeNoticePay, setIncludeNoticePay] = useState(true);
  const [includeServiceBenefit, setIncludeServiceBenefit] = useState(true);
  const [unusedLeaveDays, setUnusedLeaveDays] = useState("0");
  const [unpaidSalaryDays, setUnpaidSalaryDays] = useState("0");
  const [deductions, setDeductions] = useState("0");

  const [isOpen, setIsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input: ReleaseInput = {
    releaseDate,
    separationType,
    basicSalary: toNumber(basicSalary),
    includeNoticePay,
    includeServiceBenefit,
    unusedLeaveDays: toNumber(unusedLeaveDays),
    unpaidSalaryDays: toNumber(unpaidSalaryDays),
    deductions: toNumber(deductions),
  };
  // Derived on every render, so changing the release date updates service length and every amount.
  const result = calculateSettlement({ ...input, joiningDate });

  const joining = parseDateInput(joiningDate);
  const release = parseDateInput(releaseDate);
  const releaseBeforeJoining = joining !== null && release !== null && release < joining;
  const blockingError = !release
    ? "Enter the release date"
    : releaseBeforeJoining
      ? "Release date is before the joining date"
      : input.basicSalary > 0
        ? null
        : "Enter the basic salary";

  const selectSeparation = (value: SeparationKind) => {
    setSeparationType(value);
    // Notice pay is owed by the employer on termination, not on resignation.
    setIncludeNoticePay(value === "TERMINATED");
  };

  const processRelease = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await releaseEmployee(employeeId, input);
      if (response.ok) {
        setConfirmOpen(false);
        router.refresh();
      } else {
        setError(response.error);
      }
    } catch {
      setError("Failed to process the release");
    } finally {
      setPending(false);
    }
  };

  const statusLabel = separationType === "TERMINATED" ? "Terminated" : "Resigned";

  return (
    <section aria-labelledby="release-calculator-title" className={clsx(cardClass, "overflow-hidden")}>
      {/* Accordion header: the heading wraps the toggle button, so screen readers announce it as a heading and a button. */}
      <h2 id="release-calculator-title">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls="release-calculator-body"
          className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors duration-150 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/40"
        >
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-brand-50 text-brand-700 shrink-0">
            <Calculator className="w-4 h-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">Release &amp; Settlement Calculator</span>
            <span className="block text-xs font-normal text-slate-600">
              Full &amp; final settlement under the Bangladesh Labour Act 2006. Nothing is saved until you confirm.
            </span>
          </span>
          <ChevronDown
            className={clsx("w-4 h-4 shrink-0 text-slate-500 transition-transform duration-200 motion-reduce:transition-none", isOpen && "rotate-180")}
            aria-hidden
          />
        </button>
      </h2>

      {/*
        Collapses by animating grid rows 0fr <-> 1fr, which eases to the content's natural height with no measuring.
        The body stays mounted, so values typed before collapsing are still there on reopen; `inert` keeps its
        fields out of the tab order and away from screen readers while collapsed.
      */}
      <div
        id="release-calculator-body"
        inert={!isOpen}
        className={clsx(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] text-xs border-t border-slate-100">
            <div className="p-5 space-y-5">
              <fieldset>
                <legend className="mb-2 font-medium text-slate-700">Separation type</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {separationOptions.map((option) => (
                    <label
                      key={option.value}
                      className={clsx(
                        "flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors duration-150",
                        separationType === option.value ? "border-brand-600 bg-brand-50/60" : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="radio"
                        name="separationType"
                        value={option.value}
                        checked={separationType === option.value}
                        onChange={() => selectSeparation(option.value)}
                        className="mt-0.5 accent-brand-600"
                      />
                      <span>
                        <span className="block font-semibold text-slate-900">{option.label}</span>
                        <span className="block text-[11px] text-slate-600">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="Release date"
                  required
                  hint="Defaults to today (Dhaka time)"
                  error={releaseBeforeJoining ? "Must be on or after the joining date" : null}
                >
                  <input type="date" value={releaseDate} min={joiningDate} onChange={(e) => setReleaseDate(e.target.value)} className={controlClass} />
                </FormField>
                <FormField
                  label="Basic salary (BDT / month)"
                  required
                  hint={initialBasicSalary ? "From salary structure" : "No salary structure on file"}
                >
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(e.target.value)}
                    placeholder="e.g. 25000"
                    className={controlClass}
                  />
                </FormField>
              </div>

              <p className="px-3 py-2 rounded-lg bg-surface-muted border border-slate-200 text-slate-700">
                Joining date: <strong className="text-slate-900">{joining ? formatDateInput(joining) : "Not set"}</strong>
                {" · "}Service length:{" "}
                <strong className="text-slate-900">
                  {result.completedYears} yr {result.remainingMonths} mo {result.remainingDays} days
                </strong>
                <span className="text-slate-500"> ({result.totalDays.toLocaleString()} calendar days)</span>
              </p>

              <fieldset className="space-y-2">
                <legend className="mb-2 font-medium text-slate-700">Bangladesh Labour Act criteria</legend>
                <label className={clsx("flex items-start gap-2.5", separationType === "RESIGNED" ? "cursor-not-allowed" : "cursor-pointer")}>
                  <input
                    type="checkbox"
                    checked={separationType === "TERMINATED" && includeNoticePay}
                    disabled={separationType === "RESIGNED"}
                    onChange={(e) => setIncludeNoticePay(e.target.checked)}
                    className="mt-0.5 accent-brand-600"
                  />
                  <span className={separationType === "RESIGNED" ? "text-slate-500" : "text-slate-800"}>
                    <span className="font-medium">{SETTLEMENT_POLICY.noticePayDays} days notice pay</span> (Basic ÷ 30 × {SETTLEMENT_POLICY.noticePayDays})
                    <span className="block text-[11px] text-slate-500">
                      {separationType === "RESIGNED"
                        ? "Not payable when the employee resigns"
                        : "Wages in lieu of notice when the company did not serve notice"}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeServiceBenefit}
                    onChange={(e) => setIncludeServiceBenefit(e.target.checked)}
                    className="mt-0.5 accent-brand-600"
                  />
                  <span className="text-slate-800">
                    <span className="font-medium">Service benefit</span> (set automatically by separation type and service)
                    <span className="block text-[11px] text-slate-500">{result.serviceBenefitRule.description}</span>
                    <span className="block text-[11px] text-slate-500">
                      {separationType === "TERMINATED"
                        ? `Terminated: ${SETTLEMENT_POLICY.terminationDaysPerYear} days per year; a final part-year of ${SETTLEMENT_POLICY.partYearRoundUpMonths}+ months counts as a year`
                        : "Resigned: under 5 yr none, 5 to under 10 yr 14 days, 10+ yr 30 days, per completed year"}
                    </span>
                  </span>
                </label>
              </fieldset>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Unused leave (days)" hint="Earned leave to encash">
                  <input type="number" inputMode="decimal" min={0} step="0.5" value={unusedLeaveDays} onChange={(e) => setUnusedLeaveDays(e.target.value)} className={controlClass} />
                </FormField>
                <FormField label="Unpaid current month days" hint="Days worked but not yet paid">
                  <input type="number" inputMode="decimal" min={0} step="0.5" value={unpaidSalaryDays} onChange={(e) => setUnpaidSalaryDays(e.target.value)} className={controlClass} />
                </FormField>
                <FormField label="Deductions (BDT)" hint="Advance, loan, company assets">
                  <input type="number" inputMode="decimal" min={0} step="0.01" value={deductions} onChange={(e) => setDeductions(e.target.value)} className={controlClass} />
                </FormField>
              </div>
            </div>

            {/* Live breakdown */}
            <div className="p-5 bg-surface-muted border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col gap-4">
              <div>
                <h3 className="font-semibold text-slate-900">Settlement breakdown</h3>
                <p className="text-[11px] text-slate-600">Daily basic: {formatMoney(result.dailyBasic)} (basic ÷ 30)</p>
              </div>
              <dl aria-live="polite" className="divide-y divide-slate-200">
                <BreakdownRow
                  label="Notice pay"
                  detail={result.noticePayApplied ? `${SETTLEMENT_POLICY.noticePayDays} days` : "Not applied"}
                  value={formatMoney(result.noticePay)}
                />
                <BreakdownRow
                  label="Service benefit"
                  detail={includeServiceBenefit ? `${result.serviceBenefitRule.years} yr × ${result.serviceBenefitRule.daysPerYear} days` : "Not applied"}
                  value={formatMoney(result.serviceBenefit)}
                />
                <BreakdownRow label="Leave encashment" detail={`${input.unusedLeaveDays} days`} value={formatMoney(result.leaveEncashment)} />
                <BreakdownRow label="Unpaid salary" detail={`${input.unpaidSalaryDays} days`} value={formatMoney(result.unpaidSalary)} />
                {result.deductions > 0 && <BreakdownRow label="Deductions" value={`− ${formatMoney(result.deductions)}`} tone="negative" />}
                <div className="flex items-baseline justify-between gap-3 pt-3">
                  <dt className="font-semibold text-slate-900">Total net settlement</dt>
                  <dd className={clsx("text-base font-bold tabular-nums", result.netPayable < 0 ? "text-rose-700" : "text-brand-800")}>
                    {formatMoney(result.netPayable)}
                  </dd>
                </div>
              </dl>
              {result.netPayable < 0 && (
                <p className="text-[11px] font-medium text-rose-700">Deductions exceed the amount payable; the employee owes the difference.</p>
              )}

              <div className="mt-auto space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setConfirmOpen(true);
                  }}
                  disabled={blockingError !== null}
                  aria-describedby={blockingError ? "release-blocked-reason" : undefined}
                  className={clsx(dangerButtonClass, "w-full inline-flex items-center justify-center gap-2")}
                >
                  <UserX className="w-4 h-4" aria-hidden /> Confirm &amp; Process Release
                </button>
                {blockingError && (
                  <p id="release-blocked-reason" className="text-[11px] text-slate-600 text-center">
                    {blockingError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={processRelease}
        tone="danger"
        title={`Release ${employeeName}?`}
        description={`Their status changes to ${statusLabel} and this settlement is stored as their final record. A processed release cannot be recalculated.`}
        confirmLabel="Process Release"
        pendingLabel="Processing…"
        pending={pending}
        error={error}
      >
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2 rounded-lg bg-surface-muted border border-slate-200">
          <dt className="text-slate-600">Release date</dt>
          <dd className="text-right font-medium text-slate-900">{releaseDate}</dd>
          <dt className="text-slate-600">Separation</dt>
          <dd className="text-right font-medium text-slate-900">{statusLabel}</dd>
          <dt className="text-slate-600">Net settlement</dt>
          <dd className="text-right font-bold text-slate-900 tabular-nums">{formatMoney(result.netPayable)}</dd>
        </dl>
      </ConfirmModal>
    </section>
  );
}

"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Banknote, CalendarDays, Loader2, PlayCircle } from "lucide-react";
import { clsx } from "clsx";
import type { PayrollStatus } from "@prisma/client";
import { generatePayroll, updatePayrollStatus } from "@/app/actions/payroll";
import { parsePeriodParam, periodParam, type PayrollPeriod } from "@/lib/payroll";
import FormField from "@/components/ui/FormField";
import { ConfirmModal } from "@/components/ui/Modal";
import { controlClass } from "@/components/ui/styles";

interface ControlsProps {
  period: PayrollPeriod;
  periodLabel: string;
  activeCompanyId: string | null;
  scopeLabel: string;
  hasRecords: boolean;
}

export function PayrollControls({ period, periodLabel, activeCompanyId, scopeLabel, hasRecords }: ControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isNavigating, startNavigation] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const verb = hasRecords ? "Regenerate" : "Generate";

  const openConfirm = () => {
    setGenerateError(null);
    setSuccessMessage(null);
    setConfirmOpen(true);
  };

  // Failures stay in the dialog so the admin can retry or cancel; success closes it and reports below the controls.
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const result = await generatePayroll(period.month, period.year, activeCompanyId ?? undefined);
      if (result.ok) {
        setConfirmOpen(false);
        setSuccessMessage(result.message);
      } else {
        setGenerateError(result.error);
      }
    } catch {
      setGenerateError("Payroll generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <div className="relative w-44">
          <CalendarDays className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" aria-hidden />
          <FormField label="Payroll month" hideLabel>
            <input
              type="month"
              autoComplete="off"
              value={periodParam(period)}
              disabled={isGenerating}
              onChange={(e) => {
                const next = parsePeriodParam(e.target.value);
                if (!next) return;
                setSuccessMessage(null);
                startNavigation(() => router.push(`${pathname}?period=${periodParam(next)}`));
              }}
              className={clsx(controlClass, "pl-8 py-1.5 text-xs font-medium")}
            />
          </FormField>
        </div>
        <button
          onClick={openConfirm}
          disabled={isGenerating || isNavigating}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors duration-150"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <PlayCircle className="w-4 h-4" aria-hidden />}
          {isGenerating ? "Generating…" : `${verb} Payroll`}
        </button>
      </div>
      {successMessage && (
        <p role="status" className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700 max-w-md text-right">
          {successMessage}
        </p>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleGenerate}
        icon={Banknote}
        title={`${verb} payroll for ${periodLabel}?`}
        description={`Pay-slips are calculated for every active employee with a salary structure in ${scopeLabel}, including late and absent fines from ${periodLabel} attendance.`}
        confirmLabel={`${verb} Payroll`}
        pendingLabel="Generating…"
        pending={isGenerating}
        error={generateError}
      >
        {hasRecords && (
          <p className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 font-medium">
            Pay-slips already exist for this month. Unpaid ones are recalculated; PAID ones are left unchanged.
          </p>
        )}
      </ConfirmModal>
    </div>
  );
}

const PAYROLL_STATUSES: PayrollStatus[] = ["DRAFT", "GENERATED", "PAID"];

// Status text is *-700 on a *-50 tint; borders are *-600 so the control edge clears 3:1 (WCAG 1.4.11).
const statusStyles: Record<PayrollStatus, string> = {
  DRAFT: "bg-slate-50 text-slate-700 border-control",
  GENERATED: "bg-amber-50 text-amber-700 border-amber-600",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-600",
};

export function PayrollStatusSelect({ recordId, status, employeeName }: { recordId: string; status: PayrollStatus; employeeName: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <FormField label={`Payroll status for ${employeeName}`} hideLabel error={error}>
      <select
        value={status}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value as PayrollStatus;
          setError(null);
          startTransition(async () => {
            try {
              const result = await updatePayrollStatus(recordId, next);
              if (!result.ok) setError(result.error);
            } catch {
              setError("Could not update status");
            }
          });
        }}
        className={clsx(
          "px-2 py-1 rounded-md border text-[11px] font-bold cursor-pointer transition-shadow duration-150 focus:outline-none focus:ring-2 focus:ring-brand-600/30 disabled:opacity-60 aria-invalid:border-rose-700",
          statusStyles[status]
        )}
      >
        {PAYROLL_STATUSES.map((s) => (
          <option key={s} value={s} className="bg-white text-slate-900">
            {s}
          </option>
        ))}
      </select>
    </FormField>
  );
}

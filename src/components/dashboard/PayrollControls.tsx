"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Loader2, PlayCircle } from "lucide-react";
import { clsx } from "clsx";
import type { PayrollStatus } from "@prisma/client";
import { generatePayroll, updatePayrollStatus, type PayrollActionResult } from "@/app/actions/payroll";
import { parsePeriodParam, periodParam, type PayrollPeriod } from "@/lib/payroll";

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
  const [result, setResult] = useState<PayrollActionResult | null>(null);
  const [isNavigating, startNavigation] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    const verb = hasRecords ? "Regenerate" : "Generate";
    if (!confirm(`${verb} payroll for ${periodLabel} (${scopeLabel})?${hasRecords ? "\n\nUnpaid pay-slips are recalculated; PAID ones are left unchanged." : ""}`)) {
      return;
    }
    setIsGenerating(true);
    setResult(null);
    try {
      setResult(await generatePayroll(period.month, period.year, activeCompanyId ?? undefined));
    } catch {
      setResult({ ok: false, error: "Payroll generation failed. Please try again." });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <label className="relative flex items-center">
          <span className="sr-only">Payroll month</span>
          <CalendarDays className="w-4 h-4 absolute left-2.5 text-slate-600 pointer-events-none" />
          <input
            type="month"
            autoComplete="off"
            value={periodParam(period)}
            onChange={(e) => {
              const next = parsePeriodParam(e.target.value);
              if (!next) return;
              setResult(null);
              startNavigation(() => router.push(`${pathname}?period=${periodParam(next)}`));
            }}
            className="pl-8 pr-2 py-1.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600"
          />
        </label>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || isNavigating}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          {isGenerating ? "Generating..." : hasRecords ? "Regenerate Payroll" : "Generate Payroll"}
        </button>
      </div>
      {result && (
        <p
          role="status"
          className={clsx(
            "px-3 py-1.5 rounded-lg border text-xs font-semibold text-black max-w-md text-right",
            result.ok ? "bg-emerald-100 border-emerald-300" : "bg-red-100 border-red-300"
          )}
        >
          {result.ok ? result.message : result.error}
        </p>
      )}
    </div>
  );
}

const PAYROLL_STATUSES: PayrollStatus[] = ["DRAFT", "GENERATED", "PAID"];

const statusStyles: Record<PayrollStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-900 border-slate-300",
  GENERATED: "bg-amber-100 text-amber-950 border-amber-300",
  PAID: "bg-emerald-100 text-emerald-950 border-emerald-300",
};

export function PayrollStatusSelect({ recordId, status }: { recordId: string; status: PayrollStatus }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <select
        aria-label="Payroll status"
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
          "px-2 py-1 rounded-md border text-[11px] font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:opacity-60",
          statusStyles[status]
        )}
      >
        {PAYROLL_STATUSES.map((s) => (
          <option key={s} value={s} className="bg-white text-black">
            {s}
          </option>
        ))}
      </select>
      {error && <span className="text-[11px] font-semibold text-black bg-red-100 border border-red-300 rounded px-1.5 py-0.5">{error}</span>}
    </div>
  );
}

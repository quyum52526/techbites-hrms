"use client";

import { startTransition, useActionState, useState } from "react";
import { ReceiptText } from "lucide-react";
import { saveEmployeeDeductions, type DeductionActionResult } from "@/app/actions/payroll-deductions";
import Modal, { ModalActions } from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import { SubmitButton } from "@/components/ui/FormFeedback";
import { controlClass, secondaryButtonClass } from "@/components/ui/styles";
import { MAX_DEDUCTION_REMARKS, parseDeductionAmount, payrollTotals } from "@/lib/payroll-deductions";

const money = (value: number) => `৳${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type DeductionTarget = {
  employeeId: string;
  name: string;
  code: string;
  regularGross: number;
  festivalBonus: number;
  baseDeductions: number;
  advanceDeduction: number;
  demurrageClaim: number;
  remarks: string | null;
};

interface Props {
  target: DeductionTarget;
  /** Payroll month the entry belongs to, "YYYY-MM". */
  period: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/** Advance deduction, demurrage claim and remarks for one employee and month, with a live total/net preview. */
export default function ManageDeductionsDialog({ target, period, onClose, onSaved }: Props) {
  const [advance, setAdvance] = useState(target.advanceDeduction ? String(target.advanceDeduction) : "");
  const [demurrage, setDemurrage] = useState(target.demurrageClaim ? String(target.demurrageClaim) : "");
  const [state, action, pending] = useActionState(async (prev: DeductionActionResult | null, formData: FormData) => {
    const result = await saveEmployeeDeductions(prev, formData);
    if (result.ok) onSaved(result.message);
    return result;
  }, null);

  // Preview only; the server parses and validates again. Invalid input previews as 0.
  const preview = (raw: string) => {
    const parsed = parseDeductionAmount(raw, "");
    return parsed.ok ? parsed.value : 0;
  };
  const totals = payrollTotals({ ...target, advanceDeduction: preview(advance), demurrageClaim: preview(demurrage) });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      icon={
        <span className="grid place-items-center w-9 h-9 rounded-lg bg-rose-50 text-rose-700 shrink-0">
          <ReceiptText className="w-4 h-4" aria-hidden />
        </span>
      }
      title={`Manage deductions · ${target.name}`}
      description={`${target.code} · payroll month ${period}`}
      dismissible={!pending}
    >
      {/* Submitted by hand, not via the `action` prop, so React does not reset the form after a validation error. */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => action(formData));
        }}
        className="p-4 sm:p-6 space-y-4 text-xs"
      >
        <input type="hidden" name="employeeId" value={target.employeeId} />
        <input type="hidden" name="period" value={period} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Advance deduction (৳)" hint="Recovery of a salary advance this month">
            <input
              name="advanceDeduction"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={advance}
              onChange={(event) => setAdvance(event.target.value)}
              placeholder="0.00"
              className={controlClass}
            />
          </FormField>
          <FormField label="Demurrage claim (৳)" hint="Damages or penalty claimed this month">
            <input
              name="demurrageClaim"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={demurrage}
              onChange={(event) => setDemurrage(event.target.value)}
              placeholder="0.00"
              className={controlClass}
            />
          </FormField>
        </div>
        <FormField label="Reason / note" hint="Shown to HR in the register and exports, e.g. the claim reference">
          <textarea name="remarks" rows={2} maxLength={MAX_DEDUCTION_REMARKS} defaultValue={target.remarks ?? ""} className={controlClass} />
        </FormField>

        <dl className="rounded-lg border border-slate-200 bg-surface-muted p-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
          <dt className="text-slate-600">Tax, PF &amp; unpaid absence</dt>
          <dd className="text-right tabular-nums text-slate-900">{money(target.baseDeductions)}</dd>
          <dt className="text-slate-600">Advance + demurrage</dt>
          <dd className="text-right tabular-nums text-slate-900">{money(preview(advance) + preview(demurrage))}</dd>
          <dt className="font-semibold text-slate-900 border-t border-slate-200 pt-1.5">Total deductions</dt>
          <dd className="text-right tabular-nums font-semibold text-rose-700 border-t border-slate-200 pt-1.5">{money(totals.totalDeductions)}</dd>
          <dt className="text-slate-600">Net payable (gross {money(totals.gross)})</dt>
          <dd className="text-right tabular-nums font-bold text-slate-900">{money(totals.net)}</dd>
        </dl>
        {totals.totalDeductions > totals.gross && (
          <p className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 font-medium">
            Deductions exceed gross pay; net payable is shown as ৳0.00 and the rest is not carried forward.
          </p>
        )}

        {state && !state.ok && (
          <p role="alert" className="px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 font-medium">
            {state.error}
          </p>
        )}

        <ModalActions>
          <button type="button" onClick={onClose} disabled={pending} className={secondaryButtonClass}>
            Cancel
          </button>
          <SubmitButton pending={pending}>Save Deductions</SubmitButton>
        </ModalActions>
      </form>
    </Modal>
  );
}

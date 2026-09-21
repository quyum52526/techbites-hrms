"use client";

import { startTransition, useActionState, useState } from "react";
import { Gift, Settings2 } from "lucide-react";
import { clsx } from "clsx";
import { saveFestivalBonusPolicy, type FestivalBonusActionResult } from "@/app/actions/festival-bonus";
import Modal, { ModalActions } from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import { ActionFeedback, SubmitButton } from "@/components/ui/FormFeedback";
import { GuestLockedButton, useReadOnly } from "@/components/ui/ReadOnly";
import { controlClass, secondaryButtonClass } from "@/components/ui/styles";
import {
  FESTIVAL_BONUS_BASIS_LABELS,
  festivalBonusFormula,
  isActiveForMonth,
  MAX_FESTIVAL_BONUS_PERCENTAGE,
  MONTH_SHORT_NAMES,
  payoutMonthsLabel,
  type FestivalBonusPolicyView,
} from "@/lib/festival-bonus";
import type { PayrollPeriod } from "@/lib/payroll";

const MONTH_LONG_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface Props {
  companies: { id: string; name: string }[];
  /** Policies of `period.year` for the companies above. */
  policies: FestivalBonusPolicyView[];
  period: PayrollPeriod;
  /** HR admins only. Guests see a locked button; other roles see the summary alone. */
  canConfigure: boolean;
}

function PolicyStatus({ policy, period }: { policy: FestivalBonusPolicyView | undefined; period: PayrollPeriod }) {
  const [label, tone] = !policy
    ? ["Not configured", "bg-slate-100 text-slate-700"]
    : !policy.enabled
      ? ["Off", "bg-slate-100 text-slate-700"]
      : isActiveForMonth(policy, period)
        ? [`Paid in ${MONTH_LONG_NAMES[period.month - 1]}`, "bg-emerald-50 text-emerald-700"]
        : [`Not paid in ${MONTH_LONG_NAMES[period.month - 1]}`, "bg-amber-50 text-amber-800"];
  return <span className={clsx("px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", tone)}>{label}</span>;
}

export default function FestivalBonusPanel({ companies, policies, period, canConfigure }: Props) {
  const readOnly = useReadOnly();
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [lastSaved, setLastSaved] = useState<FestivalBonusActionResult | null>(null);
  // Closes the dialog on success and reports the result in the panel; errors stay inside the dialog.
  const [state, action, pending] = useActionState(async (prev: FestivalBonusActionResult | null, formData: FormData) => {
    const result = await saveFestivalBonusPolicy(prev, formData);
    if (result.ok) {
      setOpen(false);
      setLastSaved(result);
    }
    return result;
  }, null);

  const policyOf = (id: string) => policies.find((policy) => policy.companyId === id);
  const selected = policyOf(companyId);

  return (
    <section aria-labelledby="festival-bonus-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-accent-50 text-accent-700 shrink-0">
            <Gift className="w-4 h-4" aria-hidden />
          </span>
          <div>
            <h2 id="festival-bonus-title" className="text-sm font-bold text-slate-900">
              Festival Bonus · {period.year}
            </h2>
            <p className="text-xs text-slate-600">Added to gross pay only in each company&rsquo;s payout months.</p>
          </div>
        </div>
        {readOnly ? (
          <GuestLockedButton className={clsx(secondaryButtonClass, "text-xs")}>Configure Bonus</GuestLockedButton>
        ) : canConfigure && companies.length > 0 ? (
          <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={clsx(secondaryButtonClass, "inline-flex items-center gap-2 text-xs")}>
            <Settings2 className="w-3.5 h-3.5" aria-hidden /> Configure Bonus
          </button>
        ) : null}
      </div>

      <ul className="divide-y divide-slate-100 text-xs">
        {companies.map((company) => {
          const policy = policyOf(company.id);
          return (
            <li key={company.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
              <span className="font-semibold text-slate-900">{company.name}</span>
              <span className="flex flex-wrap items-center gap-2 text-slate-600">
                {policy?.enabled && (
                  <>
                    <span className="px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 font-semibold">{festivalBonusFormula(policy)}</span>
                    <span>paid in {payoutMonthsLabel(policy.payoutMonths)}</span>
                  </>
                )}
                <PolicyStatus policy={policy} period={period} />
              </span>
            </li>
          );
        })}
      </ul>
      <ActionFeedback state={lastSaved} className="text-xs" />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={`Festival bonus policy · ${period.year}`}
        description="One policy per company and year. Switch the payroll month to configure another year."
        dismissible={!pending}
      >
        {/* Submitted by hand, not via the `action` prop: React resets an action form after every submit, which would
            wipe what was typed on a validation error and leave the company select out of sync with its state. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => action(formData));
          }}
          className="p-4 sm:p-6 space-y-4 text-xs"
        >
          <input type="hidden" name="year" value={period.year} />
          {companies.length > 1 ? (
            <FormField label="Company" required>
              <select name="companyId" value={companyId} onChange={(event) => setCompanyId(event.target.value)} className={controlClass}>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </FormField>
          ) : (
            <input type="hidden" name="companyId" value={companyId} />
          )}

          {/* Keyed by company so switching it reloads that company's saved values. */}
          <div key={companyId} className="space-y-4">
            <fieldset className="min-w-0">
              <legend className="mb-1.5 text-xs font-medium text-slate-700">Calculated on</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(["BASIC", "TOTAL_EARNINGS"] as const).map((basis) => (
                  <label
                    key={basis}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 has-checked:border-brand-600 has-checked:bg-brand-50/60"
                  >
                    <input type="radio" name="targetBasis" value={basis} defaultChecked={(selected?.targetBasis ?? "BASIC") === basis} className="mt-0.5 accent-brand-600" />
                    <span>
                      <span className="block font-semibold text-slate-900">{FESTIVAL_BONUS_BASIS_LABELS[basis]}</span>
                      <span className="text-[11px] text-slate-600">
                        {basis === "BASIC" ? "Percentage of basic salary" : "Percentage of basic + all allowances"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <FormField label="Bonus percentage" required hint={`e.g. 50 for half a month's basis, 100 for a full month (max ${MAX_FESTIVAL_BONUS_PERCENTAGE})`}>
              <input
                name="percentage"
                type="number"
                inputMode="decimal"
                min={0.01}
                max={MAX_FESTIVAL_BONUS_PERCENTAGE}
                step={0.01}
                defaultValue={selected?.percentage ?? 50}
                className={controlClass}
              />
            </FormField>

            <fieldset className="min-w-0">
              <legend className="mb-1.5 text-xs font-medium text-slate-700">Payout months</legend>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {MONTH_SHORT_NAMES.map((name, index) => (
                  <label
                    key={name}
                    className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 font-medium text-slate-700 has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:text-brand-800"
                  >
                    <input type="checkbox" name="payoutMonths" value={index + 1} defaultChecked={selected?.payoutMonths.includes(index + 1) ?? false} className="accent-brand-600" />
                    {name}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-600">Usually the two Eid months. The bonus is added only to these payroll months.</p>
            </fieldset>

            <label className="flex items-center gap-2 font-medium text-slate-800">
              <input type="checkbox" name="enabled" defaultChecked={selected?.enabled ?? true} className="accent-brand-600" />
              Pay festival bonus in {period.year}
            </label>
          </div>

          {state && !state.ok && (
            <p role="alert" className="px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 font-medium">
              {state.error}
            </p>
          )}

          <ModalActions>
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className={secondaryButtonClass}>
              Cancel
            </button>
            <SubmitButton pending={pending}>Save Policy</SubmitButton>
          </ModalActions>
        </form>
      </Modal>
    </section>
  );
}

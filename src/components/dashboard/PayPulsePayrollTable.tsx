"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { importPayrollDeductionsCsv } from "@/app/actions/payroll-deductions";
import CsvImportModal from "@/components/dashboard/CsvImportModal";
import ManageDeductionsDialog, { type DeductionTarget } from "@/components/dashboard/ManageDeductionsDialog";
import { ActionFeedback, type ActionResult } from "@/components/ui/FormFeedback";
import { useReadOnly } from "@/components/ui/ReadOnly";

export type PayrollRow = {
  employeeId: string;
  companyId: string | null;
  company: string;
  code: string;
  name: string;
  department: string;
  payModel: "MONTHLY" | "HOURLY";
  loggedValue: number;
  loggedUnit: string;
  /** Basic + allowances, before the festival bonus. */
  regularGross: number;
  /** 0 when no bonus is paid this month. */
  festivalBonus: number;
  /** e.g. "50% of Basic"; null when no bonus is paid this month. */
  festivalBonusFormula: string | null;
  /** regularGross + festivalBonus */
  gross: number;
  /** Tax, provident fund and unpaid-absence deduction from the salary structure and attendance. */
  baseDeductions: number;
  advanceDeduction: number;
  demurrageClaim: number;
  deductionRemarks: string | null;
  /** baseDeductions + advanceDeduction + demurrageClaim */
  deductions: number;
  net: number;
  status: "PENDING";
};

// Compact filter controls, so the filters and the three actions fit on one row on a 1440px screen.
const filterLabelClass = "flex flex-col gap-1 text-xs font-medium text-slate-600";
const filterControlClass = "rounded-lg border border-slate-300 px-2.5 py-2 text-xs text-slate-900";

const money = (value: number) => `৳${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  rows: PayrollRow[];
  companies: { id: string; name: string }[];
  /** Payroll month shown, "YYYY-MM". */
  month: string;
  /** HR admins may edit and import deductions. Guests see the import locked and no row edit buttons. */
  canEditDeductions: boolean;
}

function DeductionsCell({ row, onEdit }: { row: PayrollRow; onEdit: (() => void) | null }) {
  const hasExtra = row.advanceDeduction > 0 || row.demurrageClaim > 0;
  const breakdown = `Tax, PF & absence ${money(row.baseDeductions)} + Advance ${money(row.advanceDeduction)} + Demurrage ${money(row.demurrageClaim)}${row.deductionRemarks ? ` · ${row.deductionRemarks}` : ""}`;
  return (
    <div className="flex items-start gap-1.5" title={breakdown}>
      <div className="flex flex-col items-start gap-1">
        <span className="font-semibold text-rose-700 whitespace-nowrap">{money(row.deductions)}</span>
        {hasExtra && (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 whitespace-nowrap">
            Adv: {money(row.advanceDeduction)} | Dem: {money(row.demurrageClaim)}
          </span>
        )}
        {row.deductionRemarks && <span className="max-w-44 truncate text-[10px] text-slate-500">{row.deductionRemarks}</span>}
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Manage deductions for ${row.name}`}
          className="print:hidden -mt-0.5 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

export default function PayPulsePayrollTable({ rows, companies, month, canEditDeductions }: Props) {
  const readOnly = useReadOnly();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [payModel, setPayModel] = useState("");
  const [editing, setEditing] = useState<DeductionTarget | null>(null);
  const [saved, setSaved] = useState<ActionResult | null>(null);
  const canEdit = canEditDeductions && !readOnly;

  const departmentOptions = useMemo(() => {
    const scopedRows = companyId ? rows.filter((row) => row.companyId === companyId) : rows;
    return [...new Set(scopedRows.map((row) => row.department))].sort();
  }, [rows, companyId]);
  const filtered = useMemo(() => rows.filter((row) => {
    const query = search.trim().toLowerCase();
    return (!query || row.name.toLowerCase().includes(query) || row.code.toLowerCase().includes(query)) &&
      (!companyId || row.companyId === companyId) &&
      (!department || row.department === department) &&
      (!payModel || row.payModel === payModel);
  }), [rows, search, companyId, department, payModel]);

  function exportCsv() {
    const header = ["Employee Code", "Name", "Company", "Department", "Pay Model", "Logged Metrics", "Regular Gross", "Festival Bonus", "Bonus Formula", "Gross Earnings", "Tax, PF & Absence", "Advance Deduction", "Demurrage Claim", "Deduction Remarks", "Total Deductions", "Net Payable", "Status"];
    const body = filtered.map((row) => [row.code, row.name, row.company, row.department, row.payModel, `${row.loggedValue} ${row.loggedUnit}`, row.regularGross, row.festivalBonus, row.festivalBonusFormula ?? "", row.gross, row.baseDeductions, row.advanceDeduction, row.demurrageClaim, row.deductionRemarks ?? "", row.deductions, row.net, row.status]);
    const csv = [header, ...body].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `payroll-${month}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const edit = (row: PayrollRow) => () =>
    setEditing({
      employeeId: row.employeeId,
      name: row.name,
      code: row.code,
      regularGross: row.regularGross,
      festivalBonus: row.festivalBonus,
      baseDeductions: row.baseDeductions,
      advanceDeduction: row.advanceDeduction,
      demurrageClaim: row.demurrageClaim,
      remarks: row.deductionRemarks,
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Filters shrink and wrap among themselves; the action group never wraps internally. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
          <label className={`${filterLabelClass} min-w-[160px] flex-1`}>Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or employee code" className={filterControlClass} />
          </label>
          {companies.length > 1 && <label className={filterLabelClass}>Company
            <select value={companyId} onChange={(event) => { setCompanyId(event.target.value); setDepartment(""); }} className={`${filterControlClass} max-w-44`}><option value="">All Companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
          </label>}
          <label className={filterLabelClass}>Department
            <select value={department} onChange={(event) => setDepartment(event.target.value)} className={`${filterControlClass} max-w-40`}><option value="">All Departments</option>{departmentOptions.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          <label className={filterLabelClass}>Pay Model
            <select value={payModel} onChange={(event) => setPayModel(event.target.value)} className={filterControlClass}><option value="">All Pay Models</option><option value="MONTHLY">MONTHLY</option><option value="HOURLY">HOURLY</option></select>
          </label>
        </div>
        <div className="flex shrink-0 items-stretch gap-2 whitespace-nowrap">
          {/* Guests get the import as a locked button (CsvImportModal handles that); other non-admin roles do not see it. */}
          {(canEditDeductions || readOnly) && (
            <CsvImportModal
              buttonLabel="Import Deductions"
              title="Import Payroll Deductions"
              description="Each row sets one employee's advance deduction and demurrage claim for one payroll month, replacing any earlier entry for that month. Every row is checked first; if any row has a problem, nothing is imported and each issue is listed by line."
              columns={[
                { name: "employeeCode", required: true, hint: "must belong to one of your companies" },
                { name: "period", required: true, hint: "payroll month as YYYY-MM, e.g. 2026-09" },
                { name: "advanceDeduction", required: true, hint: "amount in ৳; 0 or blank for none" },
                { name: "demurrageClaim", required: true, hint: "amount in ৳; 0 or blank for none" },
                { name: "remarks", hint: "reason, e.g. advance instalment or claim reference" },
              ]}
              templateHref="/templates/payroll-deductions-template.csv"
              action={importPayrollDeductionsCsv}
            />
          )}
          <button type="button" onClick={exportCsv} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">Export CSV</button>
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700">Export PDF</button>
        </div>
      </div>
      <ActionFeedback state={saved} className="text-xs" />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1120px] text-left text-xs">
          <thead className="bg-slate-900 text-white"><tr>{["Employee Code", "Name", "Company", "Department", "Pay Model", "Logged Metrics", "Festival Bonus", "Gross Earnings", "Deductions", "Net Payable", "Status"].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-500">No employees match your filters.</td></tr> : filtered.map((row, index) => <tr key={row.employeeId} className={index % 2 ? "bg-slate-50" : "bg-white"}>
              <td className="px-4 py-3 font-mono text-slate-900">{row.code}</td><td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td><td className="px-4 py-3 text-slate-600">{row.company}</td><td className="px-4 py-3 text-slate-600">{row.department}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{row.payModel}</span></td><td className="px-4 py-3 font-mono text-slate-900">{row.loggedValue} {row.loggedUnit}</td><td className="px-4 py-3">{row.festivalBonusFormula ? <div className="flex flex-col items-start gap-1"><span className="font-semibold text-slate-900 whitespace-nowrap">{money(row.festivalBonus)}</span><span className="rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-semibold text-accent-700 whitespace-nowrap">{row.festivalBonusFormula}</span></div> : <span className="text-slate-500" aria-label="No festival bonus">–</span>}</td><td className="px-4 py-3 text-slate-900">{money(row.gross)}</td><td className="px-4 py-3"><DeductionsCell row={row} onEdit={canEdit ? edit(row) : null} /></td><td className="px-4 py-3 font-bold text-slate-900">{money(row.net)}</td><td className="px-4 py-3"><span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">Pending</span></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Showing {filtered.length} of {rows.length} employees for {month}.</p>

      {editing && canEdit && (
        <ManageDeductionsDialog
          key={editing.employeeId}
          target={editing}
          period={month}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setSaved({ ok: true, message });
          }}
        />
      )}
    </div>
  );
}

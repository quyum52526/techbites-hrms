"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, Printer, X } from "lucide-react";
import { clsx } from "clsx";
import CompanyLogo from "@/components/dashboard/CompanyLogo";
import { formatMoney, PAYROLL_POLICY } from "@/lib/payroll";

export type PayslipData = {
  recordId: string;
  periodLabel: string;
  status: "DRAFT" | "GENERATED" | "PAID";
  paymentDate: string | null;
  generatedAt: string;
  company: {
    name: string;
    logoUrl: string | null;
    address: string | null;
    binNumber: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  employee: {
    name: string;
    employeeCode: string;
    biometricId: string | null;
    designation: string | null;
    department: string | null;
  };
  basicSalary: number;
  houseRent: number;
  medicalAllow: number;
  allowances: number;
  taxDeduction: number;
  providentFund: number;
  attendanceDeduction: number;
  lateDays: number;
  absentDays: number;
  deductions: number;
  netSalary: number;
};

const statusStyles: Record<PayslipData["status"], string> = {
  DRAFT: "bg-slate-100 text-slate-800 border-slate-300",
  GENERATED: "bg-amber-100 text-amber-900 border-amber-300",
  PAID: "bg-emerald-100 text-emerald-900 border-emerald-300",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });

export default function PayslipModal({ payslip }: { payslip: PayslipData }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Older records may only carry totals; whatever the itemized lines don't explain is shown as a remainder line.
  const otherAllowances = Math.max(0, payslip.allowances - payslip.houseRent - payslip.medicalAllow);
  const otherDeductions = Math.max(0, payslip.deductions - payslip.taxDeduction - payslip.providentFund - payslip.attendanceDeduction);
  const grossEarnings = payslip.basicSalary + payslip.allowances;

  const fineDetail = [
    payslip.absentDays > 0 && `${payslip.absentDays} absent`,
    payslip.lateDays > 0 && `${payslip.lateDays} late`,
  ].filter(Boolean).join(", ");

  const earnings: [string, number][] = [
    ["Basic Salary", payslip.basicSalary],
    ["House Rent", payslip.houseRent],
    ["Medical Allowance", payslip.medicalAllow],
    ["Other Allowances", otherAllowances],
  ];
  const deductions: [string, number][] = [
    [`Late / Absent Fine${fineDetail ? ` (${fineDetail})` : ""}`, payslip.attendanceDeduction],
    ["Income Tax", payslip.taxDeduction],
    ["Provident Fund", payslip.providentFund],
    ...(otherDeductions > 0 ? [["Other Deductions", otherDeductions] as [string, number]] : []),
  ];
  const rowCount = Math.max(earnings.length, deductions.length);

  const company = payslip.company;
  const companyContact = [company?.phone, company?.email].filter(Boolean).join("  ·  ");

  const modal = (
    <div
      className="payslip-print-root fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4 print:static print:block print:overflow-visible print:bg-white print:p-0 print:backdrop-blur-none"
      onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
    >
      <div className="w-full max-w-3xl my-8 print:my-0 print:max-w-none">
        {/* Toolbar — never printed */}
        <div className="flex items-center justify-end gap-2 mb-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print / Download PDF
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-300"
          >
            <X className="w-4 h-4" /> Close
          </button>
        </div>

        <article className="bg-white text-slate-900 rounded-xl border border-slate-300 shadow-xl p-8 text-xs print:p-0 print:m-0 print:border-none print:shadow-none print:rounded-none">
          {/* Company header */}
          <header className="flex items-start justify-between gap-6 pb-5 border-b-2 border-slate-900">
            <div className="flex items-start gap-4 min-w-0">
              {company ? (
                <CompanyLogo name={company.name} logoUrl={company.logoUrl} className="w-16 h-16 rounded-lg" />
              ) : null}
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight text-black">{company?.name ?? "Unassigned Company"}</h2>
                {company?.address && <p className="mt-1 text-slate-800 whitespace-pre-line">{company.address}</p>}
                {company?.binNumber && (
                  <p className="mt-0.5 text-slate-800">
                    BIN / Tax ID: <span className="font-mono font-semibold text-black">{company.binNumber}</span>
                  </p>
                )}
                {companyContact && <p className="mt-0.5 text-slate-800">{companyContact}</p>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-base font-bold tracking-wide text-black uppercase">Pay-slip</p>
              <p className="mt-0.5 font-semibold text-slate-900">{payslip.periodLabel}</p>
              <span className={clsx("inline-block mt-2 px-2 py-0.5 rounded border text-[10px] font-bold", statusStyles[payslip.status])}>
                {payslip.status}
              </span>
            </div>
          </header>

          {/* Employee meta */}
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 py-5 border-b border-slate-300">
            {[
              ["Employee Name", payslip.employee.name],
              ["Employee Code", payslip.employee.employeeCode],
              ["Biometric ID", payslip.employee.biometricId ?? "—"],
              ["Designation", payslip.employee.designation ?? "—"],
              ["Department", payslip.employee.department ?? "—"],
              ["Pay Period", payslip.periodLabel],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">{label}</dt>
                <dd className="mt-0.5 font-semibold text-black">{value}</dd>
              </div>
            ))}
          </dl>

          {/* Earnings vs deductions */}
          <table className="w-full mt-5 border border-slate-400 border-collapse">
            <thead>
              <tr className="bg-slate-100 text-black">
                <th className="text-left py-2 px-3 border border-slate-400 font-bold">Earnings</th>
                <th className="text-right py-2 px-3 border border-slate-400 font-bold w-32">Amount</th>
                <th className="text-left py-2 px-3 border border-slate-400 font-bold">Deductions</th>
                <th className="text-right py-2 px-3 border border-slate-400 font-bold w-32">Amount</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }, (_, i) => (
                <tr key={i} className="text-slate-900">
                  <td className="py-1.5 px-3 border border-slate-300">{earnings[i]?.[0] ?? ""}</td>
                  <td className="py-1.5 px-3 border border-slate-300 text-right font-mono tabular-nums">
                    {earnings[i] ? formatMoney(earnings[i][1]) : ""}
                  </td>
                  <td className="py-1.5 px-3 border border-slate-300">{deductions[i]?.[0] ?? ""}</td>
                  <td className="py-1.5 px-3 border border-slate-300 text-right font-mono tabular-nums">
                    {deductions[i] ? formatMoney(deductions[i][1]) : ""}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold text-black">
                <td className="py-2 px-3 border border-slate-400">Gross Earnings</td>
                <td className="py-2 px-3 border border-slate-400 text-right font-mono tabular-nums">{formatMoney(grossEarnings)}</td>
                <td className="py-2 px-3 border border-slate-400">Total Deductions</td>
                <td className="py-2 px-3 border border-slate-400 text-right font-mono tabular-nums">{formatMoney(payslip.deductions)}</td>
              </tr>
            </tbody>
          </table>

          {/* Net pay */}
          <div className="mt-4 flex items-center justify-between rounded-lg border-2 border-slate-900 px-4 py-3 print:rounded-none">
            <span className="text-sm font-bold uppercase tracking-wide text-black">Net Pay</span>
            <span className="text-xl font-bold font-mono tabular-nums text-black">{formatMoney(payslip.netSalary)}</span>
          </div>

          <p className="mt-3 text-[10px] text-slate-700">
            Late / absent fine: one day&apos;s basic (basic ÷ {PAYROLL_POLICY.dayRateDivisor}) per absent day and per every{" "}
            {PAYROLL_POLICY.lateDaysPerDayDeduction} late days.
            {payslip.paymentDate ? ` Paid on ${formatDate(payslip.paymentDate)}.` : ""} Generated on {formatDate(payslip.generatedAt)}.
          </p>

          {/* Signatures */}
          <footer className="mt-14 grid grid-cols-2 gap-16 text-center text-slate-900">
            <div className="border-t border-slate-500 pt-1.5 font-semibold">Employee Signature</div>
            <div className="border-t border-slate-500 pt-1.5 font-semibold">Authorized Signatory</div>
          </footer>
          <p className="mt-6 text-center text-[10px] text-slate-600">This is a system-generated pay-slip.</p>
        </article>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
      >
        <FileText className="w-3.5 h-3.5" /> View Pay-slip
      </button>
      {isOpen && createPortal(modal, document.body)}
    </>
  );
}

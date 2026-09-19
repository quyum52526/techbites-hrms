"use client";

import { useMemo, useState } from "react";

type PayrollRow = {
  employeeId: string;
  companyId: string | null;
  company: string;
  code: string;
  name: string;
  department: string;
  payModel: "MONTHLY" | "HOURLY";
  loggedValue: number;
  loggedUnit: string;
  gross: number;
  deductions: number;
  net: number;
  status: "PENDING";
};

const money = (value: number) => `৳${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PayPulsePayrollTable({ rows, companies, month }: { rows: PayrollRow[]; companies: { id: string; name: string }[]; month: string }) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [payModel, setPayModel] = useState("");
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
    const header = ["Employee Code", "Name", "Company", "Department", "Pay Model", "Logged Metrics", "Gross", "Deductions", "Net Payable", "Status"];
    const body = filtered.map((row) => [row.code, row.name, row.company, row.department, row.payModel, `${row.loggedValue} ${row.loggedUnit}`, row.gross, row.deductions, row.net, row.status]);
    const csv = [header, ...body].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `payroll-${month}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">Search
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or employee code" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" />
        </label>
        {companies.length > 1 && <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Company
          <select value={companyId} onChange={(event) => { setCompanyId(event.target.value); setDepartment(""); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">All Companies</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>
        </label>}
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Department
          <select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">All Departments</option>{departmentOptions.map((item) => <option key={item}>{item}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Pay Model
          <select value={payModel} onChange={(event) => setPayModel(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">All Pay Models</option><option value="MONTHLY">MONTHLY</option><option value="HOURLY">HOURLY</option></select>
        </label>
        <button type="button" onClick={exportCsv} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50">Export CSV</button>
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700">Export PDF</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-slate-900 text-white"><tr>{["Employee Code", "Name", "Company", "Department", "Pay Model", "Logged Metrics", "Gross Earnings", "Deductions", "Net Payable", "Status"].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-500">No employees match your filters.</td></tr> : filtered.map((row, index) => <tr key={row.employeeId} className={index % 2 ? "bg-slate-50" : "bg-white"}>
              <td className="px-4 py-3 font-mono text-slate-900">{row.code}</td><td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td><td className="px-4 py-3 text-slate-600">{row.company}</td><td className="px-4 py-3 text-slate-600">{row.department}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{row.payModel}</span></td><td className="px-4 py-3 font-mono text-slate-900">{row.loggedValue} {row.loggedUnit}</td><td className="px-4 py-3 text-slate-900">{money(row.gross)}</td><td className="px-4 py-3 text-rose-700">{money(row.deductions)}</td><td className="px-4 py-3 font-bold text-slate-900">{money(row.net)}</td><td className="px-4 py-3"><span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">Pending</span></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Showing {filtered.length} of {rows.length} employees for {month}.</p>
    </div>
  );
}

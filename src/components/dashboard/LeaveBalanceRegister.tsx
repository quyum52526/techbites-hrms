"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { clsx } from "clsx";
import LeaveHistoryModal from "@/components/dashboard/LeaveHistoryModal";
import { balanceStatusBadgeClass, balanceStatusLabels, type BalanceStatus, type LeaveTypeBalance } from "@/lib/leave-shared";

export type LeaveRegisterRow = {
  employeeId: string;
  name: string;
  code: string;
  department: string;
  balances: LeaveTypeBalance[];
  status: BalanceStatus;
};

function BalanceLines({ balances, pick, tone }: { balances: LeaveTypeBalance[]; pick: (b: LeaveTypeBalance) => number; tone?: (value: number) => string }) {
  return (
    <ul className="space-y-0.5">
      {balances.map((balance) => {
        const value = pick(balance);
        return (
          <li key={balance.leaveTypeId} className="flex justify-between gap-3 whitespace-nowrap">
            <span className="text-slate-500">{balance.name}</span>
            <span className={clsx("font-semibold tabular-nums", tone?.(value) ?? "text-slate-900")}>{value}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default function LeaveBalanceRegister({ rows, year, scopeLabel }: { rows: LeaveRegisterRow[]; year: number; scopeLabel: string }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? rows.filter((row) => row.name.toLowerCase().includes(query) || row.code.toLowerCase().includes(query)) : rows;
  }, [rows, search]);

  // One CSV line per employee and leave type, so the file can be pivoted in a spreadsheet.
  function exportCsv() {
    const header = ["Employee Code", "Name", "Department", "Leave Type", "Annual Quota", "Taken", "Remaining", "Status"];
    const body = filtered.flatMap((row) =>
      row.balances.map((b) => [row.code, row.name, row.department, b.name, b.quota, b.used, b.remaining, balanceStatusLabels[row.status]])
    );
    const csv = [header, ...body].map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `leave-report-${year}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          Search
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or employee code"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" aria-hidden /> Export Leave Report (CSV)
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Leave Balance Register · {year}</h3>
          <p className="text-[11px] text-slate-600">
            {scopeLabel} · taken counts calendar days of approved leave in {year}
          </p>
        </div>
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
            <tr>
              {["Employee", "Annual Quota", "Taken / Used", "Remaining Balance", "Status", "Action"].map((label) => (
                <th key={label} className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  {rows.length === 0 ? "No active employees in scope." : "No employees match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.employeeId} className="align-top hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{row.name}</p>
                    <p className="text-[11px] text-slate-500">
                      <span className="font-mono">{row.code}</span> · {row.department}
                    </p>
                  </td>
                  <td className="px-4 py-3"><BalanceLines balances={row.balances} pick={(b) => b.quota} /></td>
                  <td className="px-4 py-3"><BalanceLines balances={row.balances} pick={(b) => b.used} /></td>
                  <td className="px-4 py-3">
                    <BalanceLines
                      balances={row.balances}
                      pick={(b) => b.remaining}
                      tone={(value) => (value <= 0 ? "text-rose-700" : "text-emerald-700")}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx("px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap", balanceStatusBadgeClass[row.status])}>
                      {balanceStatusLabels[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <LeaveHistoryModal employeeId={row.employeeId} employeeName={row.name} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";

type AttendanceRow = { employeeId: string; code: string; name: string; department: string; date: string; checkIn: string | null; checkOut: string | null; hours: number; status: string };
const formatTime = (value: string | null) => value ? new Date(value).toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" }) : "—";

export default function PayPulseAttendanceTable({ rows, departments }: { rows: AttendanceRow[]; departments: string[] }) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const filtered = useMemo(() => rows.filter((row) => {
    const query = search.trim().toLowerCase();
    return (!query || row.name.toLowerCase().includes(query) || row.code.toLowerCase().includes(query)) && (!department || row.department === department) && (!status || row.status === status);
  }), [rows, search, department, status]);
  const counts = { present: rows.filter((row) => ["PRESENT", "EARLY_DEPARTURE", "HALF_DAY"].includes(row.status)).length, late: rows.filter((row) => row.status === "LATE").length, leave: rows.filter((row) => row.status === "ON_LEAVE").length, absent: rows.filter((row) => row.status === "ABSENT").length };

  return <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[["Present", counts.present, "border-emerald-500"], ["Late Arrivals", counts.late, "border-amber-500"], ["On Leave", counts.leave, "border-sky-500"], ["Absent", counts.absent, "border-rose-500"]].map(([label, value, border]) => <div key={String(label)} className={`rounded-xl border border-slate-200 border-t-4 ${border} bg-white p-5 shadow-sm`}><p className="text-xs text-slate-600">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900">{value}</p></div>)}</div>
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or employee ID" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900" /></label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Department<select value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">All Departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"><option value="">All Statuses</option>{["PRESENT", "LATE", "EARLY_DEPARTURE", "HALF_DAY", "ABSENT", "ON_LEAVE"].map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[800px] text-left text-xs"><thead className="bg-slate-900 text-white"><tr>{["Employee", "Department", "Date", "Check-In", "Check-Out", "Working Hours", "Status"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.length === 0 ? <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No attendance records match your filters.</td></tr> : filtered.map((row, index) => <tr key={row.employeeId} className={index % 2 ? "bg-slate-50" : "bg-white"}><td className="px-4 py-3"><p className="font-semibold text-slate-900">{row.name}</p><p className="font-mono text-[11px] text-slate-500">{row.code}</p></td><td className="px-4 py-3 text-slate-600">{row.department}</td><td className="px-4 py-3 font-mono text-slate-900">{row.date}</td><td className="px-4 py-3 font-mono text-slate-900">{formatTime(row.checkIn)}</td><td className="px-4 py-3 font-mono text-slate-900">{formatTime(row.checkOut)}</td><td className="px-4 py-3 font-mono text-slate-900">{row.hours.toFixed(2)} hrs</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">{row.status}</span></td></tr>)}</tbody></table></div>
    <p className="text-xs text-slate-500">Showing {filtered.length} of {rows.length} employees.</p>
  </div>;
}

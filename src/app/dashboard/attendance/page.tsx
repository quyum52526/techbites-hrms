import Link from "next/link";
import { clsx } from "clsx";
import { AttendanceStatus, Role, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Calendar, CheckCircle2, AlertCircle, UserX, Palmtree, X } from "lucide-react";
import { getActiveUser } from "@/lib/auth";
import { orgToday } from "@/lib/attendance-time";
import { getActiveCompanyId, employeeScope, WORKFORCE_STATUSES } from "@/lib/company";
import {
  checkedInWhere,
  notPunchedInWhere,
  onLeaveWhere,
  parseDateParam,
  parseFilterParam,
  parseStatusParam,
  toDateParam,
  type AttendanceFilter,
} from "@/lib/attendance-views";
import { importPunchLogsCsv } from "@/app/actions/attendance";
import CsvImportModal from "@/components/dashboard/CsvImportModal";
import StatCard from "@/components/dashboard/StatCard";

const ORG_TIME_ZONE = "Asia/Dhaka";
const RECENT_LIMIT = 50;

const statusBadge: Record<AttendanceStatus | "NOT_PUNCHED", { label: string; className: string }> = {
  PRESENT: { label: "Present", className: "bg-emerald-50 text-emerald-700" },
  LATE: { label: "Late", className: "bg-amber-50 text-amber-700" },
  HALF_DAY: { label: "Half day", className: "bg-brand-50 text-brand-700" },
  ABSENT: { label: "Absent", className: "bg-rose-50 text-rose-700" },
  ON_LEAVE: { label: "On leave", className: "bg-accent-50 text-accent-700" },
  NOT_PUNCHED: { label: "Not punched in", className: "bg-slate-100 text-slate-700" },
};

const filterLabels: Record<AttendanceFilter, string> = {
  "checked-in": "Checked in",
  "not-punched-in": "Not punched in",
  "on-leave": "On approved leave",
};

type Row = {
  key: string;
  name: string;
  code: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  status: keyof typeof statusBadge;
  source: string | null;
};

// DATE columns come back as UTC midnight, so format them in UTC to avoid shifting the day.
const formatDay = (date: Date) =>
  date.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
const formatTime = (date: Date | null) =>
  date ? date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ORG_TIME_ZONE }) : "—";

type SearchParams = { date?: string; filter?: string; status?: string };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const selectedDate = parseDateParam(params.date);
  const filter = parseFilterParam(params.filter);
  // Record-status filtering only applies to the attendance-record views, not the synthesized lists.
  const status = filter === "not-punched-in" || filter === "on-leave" ? null : parseStatusParam(params.status);
  // Filters are always about one day; without an explicit date they mean today.
  const day = selectedDate ?? (filter || status ? orgToday() : null);
  const cardDay = day ?? orgToday();

  const [user, activeCompanyId] = await Promise.all([getActiveUser(), getActiveCompanyId()]);
  const canImport = user.role === Role.SUPER_ADMIN || user.role === Role.HR_ADMIN;

  // HR sees the selected company, team leads and managers their direct reports, everyone else themselves.
  const selfId = user.employeeId ?? "__no-employee__";
  const peopleScope: Prisma.EmployeeWhereInput = canImport
    ? employeeScope(activeCompanyId)
    : user.role === Role.TEAM_LEADER || user.role === Role.MANAGER
    ? { OR: [{ id: selfId }, { managerId: selfId }] }
    : { id: selfId };
  const workforce: Prisma.EmployeeWhereInput = { ...peopleScope, status: { in: WORKFORCE_STATUSES } };

  const recordsWhere: Prisma.AttendanceRecordWhereInput = {
    ...(filter === "checked-in" && day ? checkedInWhere(workforce, day) : { employee: peopleScope }),
    ...(day ? { date: day } : {}),
    ...(status ? { status } : {}),
  };

  const employeeSelect = { firstName: true, lastName: true, employeeCode: true } as const;

  const [rows, checkedInCount, lateCount, notPunchedCount, onLeaveCount] = await Promise.all([
    (async (): Promise<Row[]> => {
      if (filter === "not-punched-in" && day) {
        const employees = await prisma.employee.findMany({
          where: notPunchedInWhere(workforce, day),
          select: { id: true, ...employeeSelect, attendances: { where: { date: day }, select: { status: true, source: true } } },
          orderBy: { firstName: "asc" },
        });
        return employees.map((e) => ({
          key: e.id,
          name: `${e.firstName} ${e.lastName}`,
          code: e.employeeCode,
          date: day,
          checkIn: null,
          checkOut: null,
          // A record without a check-in (e.g. marked ABSENT by HR) keeps its status; otherwise nothing was logged.
          status: e.attendances[0]?.status ?? "NOT_PUNCHED",
          source: e.attendances[0]?.source ?? null,
        }));
      }
      if (filter === "on-leave" && day) {
        const leaves = await prisma.leaveRequest.findMany({
          where: onLeaveWhere(workforce, day),
          select: { id: true, employee: { select: employeeSelect }, leaveType: { select: { name: true } } },
          orderBy: { employee: { firstName: "asc" } },
        });
        return leaves.map((l) => ({
          key: l.id,
          name: `${l.employee.firstName} ${l.employee.lastName}`,
          code: l.employee.employeeCode,
          date: day,
          checkIn: null,
          checkOut: null,
          status: "ON_LEAVE",
          source: l.leaveType.name,
        }));
      }
      const records = await prisma.attendanceRecord.findMany({
        where: recordsWhere,
        select: { id: true, date: true, checkIn: true, checkOut: true, status: true, source: true, employee: { select: employeeSelect } },
        orderBy: day ? { employee: { firstName: "asc" } } : [{ date: "desc" }, { checkIn: "desc" }],
        take: day ? undefined : RECENT_LIMIT,
      });
      return records.map((r) => ({
        key: r.id,
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        code: r.employee.employeeCode,
        date: r.date,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        status: r.status,
        source: r.source,
      }));
    })(),
    prisma.attendanceRecord.count({ where: checkedInWhere(workforce, cardDay) }),
    prisma.attendanceRecord.count({ where: { date: cardDay, status: "LATE", employee: peopleScope } }),
    prisma.employee.count({ where: notPunchedInWhere(workforce, cardDay) }),
    prisma.leaveRequest.count({ where: onLeaveWhere(workforce, cardDay) }),
  ]);

  const cardDateParam = toDateParam(cardDay);
  const isToday = cardDateParam === toDateParam(orgToday());
  const viewHref = (next: { filter?: AttendanceFilter; status?: AttendanceStatus }) => {
    const query = new URLSearchParams({ date: isToday ? "today" : cardDateParam });
    if (next.filter) query.set("filter", next.filter);
    if (next.status) query.set("status", next.status);
    return `/dashboard/attendance?${query}`;
  };

  const viewTitle = filter
    ? filterLabels[filter]
    : status
    ? statusBadge[status].label
    : day
    ? "All records"
    : "Recent records";
  const hasFilters = Boolean(selectedDate || filter || status);
  const showDateColumn = !day;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Attendance & Shifts</h1>
          <p className="text-xs text-slate-600">Monitor employee punch logs, working hours, and shift adherence</p>
        </div>
        {canImport && (
          <CsvImportModal
            buttonLabel="Upload Punch Logs (.csv)"
            title="Upload Biometric Punch Logs"
            description="Each row is one punch from the biometric device. For every employee and day, the first punch becomes the check-in and the last punch the check-out. Check-ins are marked PRESENT or LATE using the shift policy from Settings. Re-uploading the same log does not create duplicates."
            columns={[
              { name: "biometricId", required: true, hint: "must match an employee's Biometric / Device ID" },
              {
                name: "timestamp",
                required: true,
                hint: "Bangladesh time (GMT+6) as DD/MM/YYYY HH:mm:ss (e.g. 17/09/2026 09:05:12) or YYYY-MM-DD HH:mm:ss",
              },
            ]}
            templateHref="/templates/punch-log-template.csv"
            action={importPunchLogsCsv}
          />
        )}
      </div>

      {/* Day summary: each tile applies its filter to the table below. */}
      <section aria-labelledby="day-summary">
        <h2 id="day-summary" className="sr-only">
          Summary for {formatDay(cardDay)}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Checked in"
            value={checkedInCount}
            icon={CheckCircle2}
            tone="success"
            href={viewHref({ filter: "checked-in" })}
            active={filter === "checked-in"}
            hint={isToday ? "Today" : formatDay(cardDay)}
          />
          <StatCard
            label="Late arrivals"
            value={lateCount}
            icon={AlertCircle}
            tone="warning"
            href={viewHref({ status: "LATE" })}
            active={!filter && status === "LATE"}
            hint="After shift start + grace"
          />
          <StatCard
            label="Not punched in"
            value={notPunchedCount}
            icon={UserX}
            tone="brand"
            href={viewHref({ filter: "not-punched-in" })}
            active={filter === "not-punched-in"}
            badge={notPunchedCount > 0 ? { label: "Follow up", tone: "warning" } : { label: "Everyone in", tone: "success" }}
          />
          <StatCard
            label="On approved leave"
            value={onLeaveCount}
            icon={Palmtree}
            tone="accent"
            href={viewHref({ filter: "on-leave" })}
            active={filter === "on-leave"}
          />
        </div>
      </section>

      {/* Attendance Logs Table */}
      <section aria-labelledby="attendance-logs" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="attendance-logs" className="text-sm font-bold text-slate-900">
              {viewTitle}
              <span className="ml-2 text-xs font-medium text-slate-600 tabular-nums">
                {rows.length}
                {!day && rows.length === RECENT_LIMIT ? "+" : ""}
              </span>
            </h2>
            <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
              <Calendar className="w-3.5 h-3.5" aria-hidden />
              {day ? formatDay(day) : `Latest ${RECENT_LIMIT} punches across all days`}
            </p>
          </div>

          {/* Plain GET form: filters live in the URL, so every view is linkable and works without JS. */}
          <form method="get" action="/dashboard/attendance" className="flex flex-wrap items-end gap-2">
            {filter && <input type="hidden" name="filter" value={filter} />}
            <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
              Date
              <input
                type="date"
                name="date"
                defaultValue={day ? toDateParam(day) : toDateParam(orgToday())}
                max={toDateParam(orgToday())}
                className="h-8 rounded-lg border border-control bg-white px-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </label>
            {filter !== "not-punched-in" && filter !== "on-leave" && (
              <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-600">
                Status
                <select
                  name="status"
                  defaultValue={status ?? ""}
                  className="h-8 rounded-lg border border-control bg-white px-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                >
                  <option value="">Any status</option>
                  {Object.values(AttendanceStatus).map((s) => (
                    <option key={s} value={s}>
                      {statusBadge[s].label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="submit"
              className="h-8 px-3 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold transition-colors duration-200"
            >
              Apply
            </button>
            {hasFilters && (
              <Link
                href="/dashboard/attendance"
                className="h-8 inline-flex items-center gap-1 px-2.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors duration-200"
              >
                <X className="w-3.5 h-3.5" aria-hidden /> Clear
              </Link>
            )}
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Employee</th>
                {showDateColumn && <th className="py-3 px-4 font-semibold">Date</th>}
                <th className="py-3 px-4 font-semibold">Check In</th>
                <th className="py-3 px-4 font-semibold">Check Out</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">{filter === "on-leave" ? "Leave type" : "Source"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={showDateColumn ? 6 : 5} className="py-8 text-center text-slate-600">
                    {filter === "not-punched-in"
                      ? "Everyone in scope has punched in or is on approved leave."
                      : hasFilters
                      ? "No records match these filters."
                      : "No attendance logs recorded yet. Punch in from the dashboard to create logs."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50 transition-colors duration-150">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{row.name}</p>
                      <p className="text-[11px] text-slate-600 font-mono">{row.code}</p>
                    </td>
                    {showDateColumn && <td className="py-3 px-4 text-slate-600">{formatDay(row.date)}</td>}
                    <td className="py-3 px-4 text-slate-700 font-medium tabular-nums">{formatTime(row.checkIn)}</td>
                    <td className="py-3 px-4 text-slate-700 font-medium tabular-nums">{formatTime(row.checkOut)}</td>
                    <td className="py-3 px-4">
                      <span className={clsx("px-2 py-0.5 rounded-full text-[11px] font-semibold", statusBadge[row.status].className)}>
                        {statusBadge[row.status].label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {row.source ? (
                        <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{row.source}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

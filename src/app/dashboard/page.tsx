import { prisma } from "@/lib/prisma";
import { Users, Clock, CalendarCheck2, Building2, UserPlus, Fingerprint, UserX } from "lucide-react";
import { Role, type EmployeeStatus, type Prisma } from "@prisma/client";
import QuickPunch from "@/components/dashboard/QuickPunch";
import StatCard from "@/components/dashboard/StatCard";
import Link from "next/link";
import { canAccess, getActiveUser } from "@/lib/auth";
import {
  NO_EMPLOYEES,
  canSwitchCompany,
  departmentScope,
  employeeScope,
  getActiveCompanyId,
  getOwnCompanyId,
  workforceScope,
} from "@/lib/company";
import { DEFAULT_SHIFT_POLICY, ORG_UTC_OFFSET_MINUTES, orgToday } from "@/lib/attendance-time";
import { checkedInWhere, notPunchedInWhere, onLeaveWhere } from "@/lib/attendance-views";

const statusBadge: Record<EmployeeStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-emerald-50 text-emerald-700" },
  PROBATION: { label: "Probation", className: "bg-brand-50 text-brand-700" },
  NOTICE_PERIOD: { label: "Notice period", className: "bg-amber-50 text-amber-700" },
  RESIGNED: { label: "Resigned", className: "bg-slate-100 text-slate-700" },
  TERMINATED: { label: "Terminated", className: "bg-rose-50 text-rose-700" },
};

export default async function DashboardPage() {
  const today = orgToday();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1) - ORG_UTC_OFFSET_MINUTES * 60_000);

  const user = await getActiveUser();
  const isHr = canAccess(user.role, "hr");
  // Managers see company totals here but can't open the Leaves/Attendance lists behind them, so their tiles stay static.
  const canDrillDown = user.role !== Role.MANAGER;

  // Switcher roles follow the selected company (or all). Everyone else, managers included, is pinned to the
  // company on their own employee record; with no company they get an empty scope, never the whole group's data.
  const switcher = canSwitchCompany(user.role);
  const companyId = switcher ? await getActiveCompanyId() : await getOwnCompanyId(user.employeeId);
  const hasNoCompany = !switcher && !companyId;
  const employeeWhere = hasNoCompany ? NO_EMPLOYEES : employeeScope(companyId);
  const workforceWhere = hasNoCompany ? NO_EMPLOYEES : workforceScope(companyId);
  const departmentWhere: Prisma.DepartmentWhereInput = hasNoCompany ? { id: { in: [] } } : departmentScope(companyId);

  const [
    headcount,
    joinedThisMonth,
    totalDepartments,
    pendingLeaves,
    recentEmployees,
    presentToday,
    onLeaveToday,
    notPunchedToday,
    shift,
    myAttendance,
  ] = await Promise.all([
    prisma.employee.count({ where: workforceWhere }),
    prisma.employee.count({ where: { ...workforceWhere, joiningDate: { gte: monthStart } } }),
    prisma.department.count({ where: departmentWhere }),
    prisma.leaveRequest.count({ where: { status: "PENDING", employee: employeeWhere } }),
    prisma.employee.findMany({
      where: employeeWhere,
      take: 5,
      include: { department: true, designation: true },
      orderBy: { createdAt: "desc" },
    }),
    // Same definitions as the Attendance page filters, so each tile's number matches the list it opens.
    prisma.attendanceRecord.count({ where: checkedInWhere(workforceWhere, today) }),
    prisma.leaveRequest.count({ where: onLeaveWhere(workforceWhere, today) }),
    prisma.employee.count({ where: notPunchedInWhere(workforceWhere, today) }),
    prisma.shift.findFirst({ orderBy: { createdAt: "asc" }, select: { name: true, startTime: true, endTime: true } }),
    // QuickPunch is personal: it reads the signed-in user's own record, never another employee's.
    user.employeeId
      ? prisma.attendanceRecord.findUnique({
          where: { employeeId_date: { employeeId: user.employeeId, date: today } },
          select: { checkIn: true, checkOut: true },
        })
      : null,
  ]);

  const attendanceRate = headcount > 0 ? Math.round((presentToday / headcount) * 100) : 0;
  const avgTeamSize = totalDepartments > 0 ? Math.round(headcount / totalDepartments) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">HR Operations Overview</h1>
          <p className="text-xs text-slate-600">Real-time workforce snapshot and quick actions</p>
        </div>
        {isHr && (
          <Link
            href="/dashboard/employees"
            className="flex items-center gap-2 bg-brand-gradient text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-shadow duration-200 hover:shadow-md"
          >
            <UserPlus className="w-4 h-4" aria-hidden /> Add Employee
          </Link>
        )}
      </div>

      {hasNoCompany && (
        <p role="status" className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-xs font-medium text-amber-800">
          Your account is not linked to a company yet, so company figures are empty. Ask an administrator to assign one.
        </p>
      )}

      {/* Metrics Row: tiles drill into the list behind their number where the role can open that list. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          label="Headcount"
          className="sm:col-span-2 xl:col-span-1"
          value={headcount}
          icon={Users}
          tone="brand"
          href={isHr ? "/dashboard/employees" : undefined}
          badge={{ label: `+${joinedThisMonth} this month`, tone: joinedThisMonth > 0 ? "success" : "neutral" }}
          hint="Active, probation & notice"
        />
        <StatCard
          label="Departments"
          value={totalDepartments}
          icon={Building2}
          tone="accent"
          href={isHr ? "/dashboard/departments" : undefined}
          badge={{ label: `~${avgTeamSize} per team`, tone: "neutral" }}
        />
        <StatCard
          label="Pending Leaves"
          value={pendingLeaves}
          icon={CalendarCheck2}
          tone="warning"
          href={canDrillDown ? "/dashboard/leaves?status=PENDING" : undefined}
          badge={pendingLeaves > 0 ? { label: "Needs review", tone: "warning" } : { label: "All clear", tone: "success" }}
        />
        <StatCard
          label="Today's Attendance"
          value={
            <>
              {presentToday}
              <span className="text-base font-semibold text-slate-500"> / {headcount}</span>
            </>
          }
          icon={Clock}
          tone="success"
          href={canDrillDown ? "/dashboard/attendance?date=today&filter=checked-in" : undefined}
          badge={{ label: `${attendanceRate}% present`, tone: attendanceRate >= 80 ? "success" : "warning" }}
        />
        <StatCard
          label="Not Punched In"
          value={notPunchedToday}
          icon={UserX}
          tone="brand"
          href={canDrillDown ? "/dashboard/attendance?date=today&filter=not-punched-in" : undefined}
          badge={notPunchedToday > 0 ? { label: "Follow up", tone: "warning" } : { label: "Everyone in", tone: "success" }}
          hint={`${onLeaveToday} on approved leave`}
        />
      </div>

      {/* Interactive Hub: items-start keeps the punch card compact instead of stretching to the table's height. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {user.employeeId ? (
          <QuickPunch
            checkIn={myAttendance?.checkIn?.toISOString() ?? null}
            checkOut={myAttendance?.checkOut?.toISOString() ?? null}
            shiftName={shift?.name ?? "General Shift"}
            shiftStart={shift?.startTime ?? DEFAULT_SHIFT_POLICY.startTime}
            shiftEnd={shift?.endTime ?? "18:00"}
          />
        ) : (
          <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600">
              <Fingerprint className="w-5 h-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Web punch unavailable</h2>
              <p className="text-xs text-slate-600 mt-1">
                Your login is not linked to an employee record, so there is no attendance to mark.
              </p>
            </div>
          </section>
        )}

        <section className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900">Recent Employees</h2>
            {isHr && (
              <Link href="/dashboard/employees" className="text-xs font-medium text-brand-700 hover:underline">
                View all
              </Link>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted text-slate-600 border-y border-slate-100">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Employee</th>
                  <th className="py-2.5 px-3 font-semibold">Code</th>
                  <th className="py-2.5 px-3 font-semibold">Department</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-600">
                      No employees in this company yet.
                    </td>
                  </tr>
                ) : (
                  recentEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50 transition-colors duration-150">
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {emp.firstName} {emp.lastName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono">{emp.employeeCode}</td>
                      <td className="py-2.5 px-3 text-slate-600">{emp.department?.name ?? "N/A"}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusBadge[emp.status].className}`}>
                          {statusBadge[emp.status].label}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

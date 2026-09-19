import Link from "next/link";
import { clsx } from "clsx";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Banknote, BarChart3, TrendingUp, Users, CalendarCheck, Building, ShieldAlert } from "lucide-react";
import { getActiveUser, type ActiveUser } from "@/lib/auth";
import { canSwitchCompanyForUser, departmentScope, employeeScope, getActiveCompanyId, getOwnCompanyId } from "@/lib/company";
import { formatMoney } from "@/lib/payroll";
import StatCard from "@/components/dashboard/StatCard";
import { cardClass, secondaryButtonClass } from "@/components/ui/styles";

/** Roles allowed to see executive and payroll totals. Keep in sync with the Reports entry in Sidebar.tsx. */
const REPORT_ROLES: Role[] = [Role.SUPER_ADMIN, Role.HR_ADMIN, Role.MANAGER];
type ReportScope = { allowed: true; companyId: string | null } | { allowed: false; reason: string };

/**
 * Which company the numbers cover. Admins follow the switcher; a manager is pinned to the company on their
 * own employee record, and is refused rather than shown every company's totals when that is missing.
 */
async function getReportScope(user: ActiveUser): Promise<ReportScope> {
  if (!REPORT_ROLES.includes(user.role)) {
    return { allowed: false, reason: "Reports & BI shows company-wide payroll and workforce totals, so it is limited to administrators and managers." };
  }
  if (await canSwitchCompanyForUser(user)) return { allowed: true, companyId: await getActiveCompanyId() };

  const companyId = await getOwnCompanyId(user.employeeId);
  if (!companyId) {
    return { allowed: false, reason: "Your account is not linked to a company yet. Ask an administrator to assign one." };
  }
  return { allowed: true, companyId };
}

export default async function ReportsPage() {
  const user = await getActiveUser();
  const scope = await getReportScope(user);

  if (!scope.allowed) {
    return (
      <div className={clsx(cardClass, "max-w-lg mx-auto mt-12 p-6 text-center space-y-3")}>
        <div className="mx-auto grid place-items-center w-11 h-11 rounded-full bg-rose-50 text-rose-700">
          <ShieldAlert className="w-5 h-5" aria-hidden />
        </div>
        <h2 className="text-base font-bold text-slate-900">You don&rsquo;t have access to Reports</h2>
        <p className="text-xs text-slate-600">{scope.reason}</p>
        <Link href="/dashboard" className={clsx(secondaryButtonClass, "inline-flex text-xs")}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const { companyId } = scope;
  // Every figure below goes through these filters, so no query can leak another company's data.
  const employeeWhere = employeeScope(companyId);
  const byEmployee = companyId ? { employee: employeeWhere } : {};
  // Pay-slips generated before companies existed have no companyId, so fall back to the employee's company.
  const payrollWhere: Prisma.PayrollRecordWhereInput = companyId
    ? { OR: [{ companyId }, { companyId: null, employee: { companyId } }] }
    : {};
  // Managers can't open the Employees, Attendance or Payroll lists, so their tiles stay static.
  const canDrillDown = await canSwitchCompanyForUser(user);

  const [
    totalEmployees,
    departments,
    totalLeaves,
    approvedLeaves,
    totalAttendanceRecords,
    payrollRecords,
    company,
  ] = await Promise.all([
    prisma.employee.count({ where: employeeWhere }),
    prisma.department.findMany({
      where: departmentScope(companyId),
      // Shared departments (no company) only count this company's people.
      include: { _count: { select: { employees: { where: employeeWhere } } } },
      orderBy: { name: "asc" },
    }),
    prisma.leaveRequest.count({ where: byEmployee }),
    prisma.leaveRequest.count({ where: { ...byEmployee, status: "APPROVED" } }),
    prisma.attendanceRecord.count({ where: byEmployee }),
    prisma.payrollRecord.findMany({ where: payrollWhere, select: { netSalary: true, status: true } }),
    companyId ? prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }) : null,
  ]);

  const totalPayrollSpend = payrollRecords.reduce((acc, curr) => acc + curr.netSalary, 0);
  const paidSlips = payrollRecords.filter((r) => r.status === "PAID").length;
  const leaveApprovalRate = totalLeaves > 0 ? Math.round((approvedLeaves / totalLeaves) * 100) : 0;
  const link = (href: string) => (canDrillDown ? href : undefined);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">HR Reports & Workforce Analytics</h2>
          <p className="text-xs text-slate-600">
            Executive metrics, department distribution, and financial summary · {company?.name ?? "All Companies"}
          </p>
        </div>
      </div>

      {/* Top-level KPIs: same StatCard tile as the Dashboard, each drilling into the list behind its number. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Workforce"
          value={totalEmployees.toLocaleString()}
          icon={Users}
          tone="brand"
          href={link("/dashboard/employees")}
          hint="All employee records"
        />
        <StatCard
          label="Leave Approval Rate"
          value={`${leaveApprovalRate}%`}
          icon={CalendarCheck}
          tone="success"
          href={link("/dashboard/leaves?status=APPROVED")}
          badge={{ label: `${approvedLeaves} of ${totalLeaves} approved`, tone: "success" }}
        />
        <StatCard
          label="Total Punches Logged"
          value={totalAttendanceRecords.toLocaleString()}
          icon={TrendingUp}
          tone="accent"
          href={link("/dashboard/attendance")}
          hint="All time"
        />
        <StatCard
          label="Cumulative Payroll"
          value={formatMoney(totalPayrollSpend)}
          icon={Banknote}
          tone="success"
          href={link("/dashboard/payroll")}
          badge={{ label: `${paidSlips} of ${payrollRecords.length} paid`, tone: paidSlips === payrollRecords.length ? "success" : "warning" }}
        />
      </div>

      {/* Analytics Breakdown Grid: informational panels, so no hover state. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution */}
        <div className={clsx(cardClass, "p-5")}>
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Building className="w-4 h-4 text-brand-600" /> Headcount by Department
          </h3>
          <div className="space-y-4">
            {departments.map((dept) => {
              const count = dept._count.employees;
              const percentage = totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0;
              return (
                <div key={dept.id} className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-700">{dept.name}</span>
                    <span className="text-slate-500">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operational Overview */}
        <div className={clsx(cardClass, "p-5 flex flex-col justify-between")}>
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-700" /> Operational Health Index
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              System health and compliance are monitored continuously. All employee clock-in events are tied to verified browser sessions with timestamp validation.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Database Engine</p>
              <p className="font-semibold text-slate-800 mt-0.5">PostgreSQL 18</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Database Host</p>
              <p className="font-semibold text-slate-800 mt-0.5">Neon (Singapore)</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Data Synchronization</p>
              <p className="font-semibold text-emerald-700 mt-0.5">Real-time (Prisma)</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Architecture</p>
              <p className="font-semibold text-slate-800 mt-0.5">Modular SaaS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
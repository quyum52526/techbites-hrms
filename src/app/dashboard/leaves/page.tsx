import Link from "next/link";
import { clsx } from "clsx";
import { LeaveStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import ApplyLeaveModal from "@/components/dashboard/ApplyLeaveModal";
import LeaveBalanceRegister, { type LeaveRegisterRow } from "@/components/dashboard/LeaveBalanceRegister";
import { updateLeaveStatus } from "@/app/actions/leaves";
import { canAccess, getActiveUser, isTeamLead } from "@/lib/auth";
import { employeeScope, getActiveCompanyId, workforceScope } from "@/lib/company";
import { getLeaveBalances } from "@/lib/leave-balance";
import { balanceStatus, leaveStatusBadgeClass, leaveStatusLabels, PENDING_LEAVE_STATUSES } from "@/lib/leave-shared";
import { CalendarDays, Check, X, Clock } from "lucide-react";

/** A single approval stage, or the virtual "PENDING" filter covering every in-flight stage. */
type LeaveFilter = LeaveStatus | "PENDING";

const STATUS_FILTERS: { value: LeaveFilter | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "PENDING", label: "Pending" },
  ...Object.values(LeaveStatus).map((status) => ({ value: status, label: leaveStatusLabels[status] })),
];

const statusesFor = (filter: LeaveFilter): LeaveStatus[] => (filter === "PENDING" ? PENDING_LEAVE_STATUSES : [filter]);
const isPending = (status: LeaveStatus) => PENDING_LEAVE_STATUSES.includes(status);
const statusHref = (filter: LeaveFilter | null) => (filter ? `/dashboard/leaves?status=${filter}` : "/dashboard/leaves");
const REGISTER_HREF = "/dashboard/leaves?view=register";

/** Active employees of the selected company with their leave balances for the current year. */
async function loadRegister(companyId: string | null) {
  const [employees, balances, company] = await Promise.all([
    prisma.employee.findMany({
      where: workforceScope(companyId),
      select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    getLeaveBalances(workforceScope(companyId)),
    companyId ? prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }) : null,
  ]);
  const rows: LeaveRegisterRow[] = employees.map((employee) => {
    const employeeBalances = balances.balancesFor(employee.id);
    return {
      employeeId: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      code: employee.employeeCode,
      department: employee.department?.name ?? "Unassigned",
      balances: employeeBalances,
      status: balanceStatus(employeeBalances),
    };
  });
  return { rows, year: balances.year, scopeLabel: company?.name ?? (companyId ? "Your company" : "All companies") };
}

export default async function LeavesPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string }> }) {
  const { status, view } = await searchParams;
  const requestedStatus = status?.toUpperCase();
  const activeFilter = STATUS_FILTERS.find((f) => f.value === requestedStatus) ?? STATUS_FILTERS[0];
  const statusFilter = activeFilter.value;

  const [user, activeCompanyId] = await Promise.all([getActiveUser(), getActiveCompanyId()]);
  // Guests browse like HR (company scope, register tab) but never get approve/reject.
  const isApprover = canAccess(user.role, "hr");
  const guest = user.role === "GUEST";
  const isLead = isTeamLead(user.role);
  const selfId = user.employeeId ?? "__no-employee__";
  // The register covers a whole company, so only HR sees it; anyone else asking for it gets the applications board.
  const showRegister = isApprover && view === "register";

  // HR sees the selected company; team leads their own and their direct reports' requests; everyone else their own.
  const leaveScope: Prisma.LeaveRequestWhereInput = isApprover
    ? { employee: employeeScope(activeCompanyId) }
    : isLead
      ? { employee: { OR: [{ id: selfId }, { managerId: selfId }, { manager: { managerId: selfId } }] } }
      : { employeeId: selfId };
  const canDecide = (status: LeaveStatus, employee: { managerId: string | null; manager: { managerId: string | null } | null }) =>
    (status === "PENDING_TL" && isLead && employee.managerId === selfId) ||
    (status === "PENDING_MANAGER" && user.role === "MANAGER" && employee.manager?.managerId === selfId) ||
    (status === "PENDING_HR" && isApprover && !guest);

  const [employees, leaveTypes] = await Promise.all([
    isApprover
      ? prisma.employee.findMany({
          where: employeeScope(activeCompanyId),
          select: { id: true, firstName: true, lastName: true },
          orderBy: { firstName: "asc" },
        })
      : prisma.employee.findMany({
          where: { id: user.employeeId ?? "__no-employee__" },
          select: { id: true, firstName: true, lastName: true },
        }),
    prisma.leaveType.findMany({ select: { id: true, name: true, daysAllowed: true } }),
  ]);

  const header = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Leave Management</h1>
          <p className="text-xs text-slate-600">Track leave requests, view quotas, and process approvals</p>
        </div>
        <ApplyLeaveModal employees={employees} leaveTypes={leaveTypes} />
      </div>
      {isApprover && (
        <nav aria-label="Leave views" className="flex gap-1 border-b border-slate-200">
          {[
            { href: "/dashboard/leaves", label: "Leave Applications", active: !showRegister },
            { href: REGISTER_HREF, label: "Leave Balance Register", active: showRegister },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={clsx(
                "-mb-px px-3 py-2 border-b-2 text-xs font-semibold transition-colors duration-150",
                tab.active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      )}
    </>
  );

  if (showRegister) {
    const register = await loadRegister(activeCompanyId);
    return (
      <div className="space-y-6">
        {header}
        <LeaveBalanceRegister rows={register.rows} year={register.year} scopeLabel={register.scopeLabel} />
      </div>
    );
  }

  const [leaves, statusCounts] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { ...leaveScope, ...(statusFilter ? { status: { in: statusesFor(statusFilter) } } : {}) },
      include: {
        employee: { include: { manager: { select: { managerId: true } } } },
        leaveType: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.leaveRequest.groupBy({ by: ["status"], where: leaveScope, _count: { _all: true } }),
  ]);

  const countOf = (status: LeaveStatus) => statusCounts.find((c) => c.status === status)?._count._all ?? 0;
  const pendingCount = PENDING_LEAVE_STATUSES.reduce((sum, status) => sum + countOf(status), 0);
  const approvedCount = countOf(LeaveStatus.APPROVED);
  const rejectedCount = countOf(LeaveStatus.REJECTED);

  const statCards: { status: LeaveFilter; label: string; count: number; icon: typeof Clock; tone: string; value: string }[] = [
    { status: "PENDING", label: "Pending Approvals", count: pendingCount, icon: Clock, tone: "text-amber-700 bg-amber-50", value: "text-amber-700" },
    { status: LeaveStatus.APPROVED, label: "Approved Leaves", count: approvedCount, icon: Check, tone: "text-emerald-700 bg-emerald-50", value: "text-emerald-700" },
    { status: LeaveStatus.REJECTED, label: "Rejected Requests", count: rejectedCount, icon: X, tone: "text-rose-700 bg-rose-50", value: "text-rose-700" },
  ];

  return (
    <div className="space-y-6">
      {header}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map(({ status, label, count, icon: Icon, tone, value }) => (
          <Link
            key={status}
            href={statusHref(statusFilter === status ? null : status)}
            className={clsx(
              "bg-white p-5 rounded-xl border shadow-sm flex items-center justify-between transition-[transform,box-shadow,border-color] duration-200 hover:shadow-md motion-safe:hover:-translate-y-0.5",
              statusFilter === status ? "border-brand-600 ring-1 ring-brand-600" : "border-slate-200 hover:border-brand-200"
            )}
          >
            <div>
              <p className="text-xs font-medium text-slate-600">{label}</p>
              <p className={clsx("text-2xl font-bold mt-1 tabular-nums", value)}>{count}</p>
            </div>
            <div className={clsx("p-3 rounded-xl", tone)}>
              <Icon className="w-5 h-5" aria-hidden />
            </div>
          </Link>
        ))}
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800">Leave Applications</h3>
          <nav aria-label="Filter by status" className="flex flex-wrap items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-slate-500 mr-1" aria-hidden />
            {STATUS_FILTERS.map((filter) => (
              <Link
                key={filter.label}
                href={statusHref(filter.value)}
                aria-current={statusFilter === filter.value ? "page" : undefined}
                className={clsx(
                  "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors duration-150",
                  statusFilter === filter.value ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {filter.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    {statusFilter
                      ? `No ${activeFilter.label.toLowerCase()} leave requests.`
                      : 'No leave requests found. Click "Apply for Leave" to create a new application.'}
                  </td>
                </tr>
              ) : (
                leaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">
                        {leave.employee.firstName} {leave.employee.lastName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">{leave.employee.employeeCode}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {leave.leaveType.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{leave.reason}</td>
                    <td className="py-3 px-4">
                      <span className={clsx("px-2 py-0.5 rounded-full text-[11px] font-semibold", leaveStatusBadgeClass(leave.status))}>
                        {leaveStatusLabels[leave.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {canDecide(leave.status, leave.employee) ? (
                        <div className="flex items-center justify-end gap-2">
                          <form action={async () => {
                            "use server";
                            await updateLeaveStatus(leave.id, "APPROVED");
                          }}>
                            <button className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md transition-colors" aria-label={`Approve leave for ${leave.employee.firstName} ${leave.employee.lastName}`}>
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </form>
                          <form action={async () => {
                            "use server";
                            await updateLeaveStatus(leave.id, "REJECTED");
                          }}>
                            <button className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-md transition-colors" aria-label={`Reject leave for ${leave.employee.firstName} ${leave.employee.lastName}`}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-600">{isPending(leave.status) ? "Awaiting approval" : "Processed"}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
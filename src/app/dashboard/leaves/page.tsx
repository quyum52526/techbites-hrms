import Link from "next/link";
import { clsx } from "clsx";
import type { LeaveStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import ApplyLeaveModal from "@/components/dashboard/ApplyLeaveModal";
import { updateLeaveStatus } from "@/app/actions/leaves";
import { canAccess, getActiveUser } from "@/lib/auth";
import { employeeScope, getActiveCompanyId } from "@/lib/company";
import { CalendarDays, Check, X, Clock } from "lucide-react";

const STATUS_FILTERS: { value: LeaveStatus | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const statusHref = (status: LeaveStatus | null) => (status ? `/dashboard/leaves?status=${status}` : "/dashboard/leaves");

export default async function LeavesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const requestedStatus = (await searchParams).status?.toUpperCase();
  const statusFilter = STATUS_FILTERS.find((f) => f.value === requestedStatus)?.value ?? null;

  const [user, activeCompanyId] = await Promise.all([getActiveUser(), getActiveCompanyId()]);
  const isApprover = canAccess(user.role, "hr");

  // Approvers see the selected company; everyone else sees only their own applications.
  const leaveScope: Prisma.LeaveRequestWhereInput = isApprover
    ? { employee: employeeScope(activeCompanyId) }
    : { employeeId: user.employeeId ?? "__no-employee__" };

  const [leaves, statusCounts, employees, leaveTypes] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { ...leaveScope, ...(statusFilter ? { status: statusFilter } : {}) },
      include: {
        employee: true,
        leaveType: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.leaveRequest.groupBy({ by: ["status"], where: leaveScope, _count: { _all: true } }),
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

  const countOf = (status: LeaveStatus) => statusCounts.find((c) => c.status === status)?._count._all ?? 0;
  const pendingCount = countOf("PENDING");
  const approvedCount = countOf("APPROVED");
  const rejectedCount = countOf("REJECTED");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Leave Management</h1>
          <p className="text-xs text-slate-600">Track leave requests, view quotas, and process approvals</p>
        </div>
        <ApplyLeaveModal employees={employees} leaveTypes={leaveTypes} />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { status: "PENDING" as const, label: "Pending Approvals", count: pendingCount, icon: Clock, tone: "text-amber-700 bg-amber-50", value: "text-amber-700" },
          { status: "APPROVED" as const, label: "Approved Leaves", count: approvedCount, icon: Check, tone: "text-emerald-700 bg-emerald-50", value: "text-emerald-700" },
          { status: "REJECTED" as const, label: "Rejected Requests", count: rejectedCount, icon: X, tone: "text-rose-700 bg-rose-50", value: "text-rose-700" },
        ].map(({ status, label, count, icon: Icon, tone, value }) => (
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
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Leave Applications</h3>
          <nav aria-label="Filter by status" className="flex items-center gap-1">
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
                      ? `No ${statusFilter.toLowerCase()} leave requests.`
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
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        leave.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700"
                          : leave.status === "REJECTED"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {leave.status === "PENDING" && isApprover ? (
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
                        <span className="text-[11px] text-slate-600">{leave.status === "PENDING" ? "Awaiting HR" : "Processed"}</span>
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
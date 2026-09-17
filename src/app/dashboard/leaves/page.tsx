import { prisma } from "@/lib/prisma";
import ApplyLeaveModal from "@/components/dashboard/ApplyLeaveModal";
import { updateLeaveStatus } from "@/app/actions/leaves";
import { CalendarDays, Check, X, Clock } from "lucide-react";

export default async function LeavesPage() {
  const [leaves, employees, leaveTypes] = await Promise.all([
    prisma.leaveRequest.findMany({
      include: {
        employee: true,
        leaveType: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.employee.findMany({ select: { id: true, firstName: true, lastName: true } }),
    prisma.leaveType.findMany({ select: { id: true, name: true, daysAllowed: true } }),
  ]);

  const pendingCount = leaves.filter((l) => l.status === "PENDING").length;
  const approvedCount = leaves.filter((l) => l.status === "APPROVED").length;
  const rejectedCount = leaves.filter((l) => l.status === "REJECTED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Leave Management</h2>
          <p className="text-xs text-slate-500">Track leave requests, view quotas, and process approvals</p>
        </div>
        <ApplyLeaveModal employees={employees} leaveTypes={leaveTypes} />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Pending Approvals</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</p>
          </div>
          <div className="p-3 rounded-xl text-amber-600 bg-amber-50">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Approved Leaves</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{approvedCount}</p>
          </div>
          <div className="p-3 rounded-xl text-emerald-600 bg-emerald-50">
            <Check className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Rejected Requests</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{rejectedCount}</p>
          </div>
          <div className="p-3 rounded-xl text-rose-600 bg-rose-50">
            <X className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Leave Applications</h3>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" /> All Records
          </span>
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
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No leave requests found. Click "Apply for Leave" to create a new application.
                  </td>
                </tr>
              ) : (
                leaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">
                        {leave.employee.firstName} {leave.employee.lastName}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">{leave.employee.employeeCode}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {leave.leaveType.name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{leave.reason}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        leave.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-600"
                          : leave.status === "REJECTED"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-amber-50 text-amber-600"
                      }`}>
                        {leave.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {leave.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-2">
                          <form action={async () => {
                            "use server";
                            await updateLeaveStatus(leave.id, "APPROVED");
                          }}>
                            <button className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-md transition-colors" title="Approve">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </form>
                          <form action={async () => {
                            "use server";
                            await updateLeaveStatus(leave.id, "REJECTED");
                          }}>
                            <button className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition-colors" title="Reject">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Processed</span>
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
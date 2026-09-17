import { prisma } from "@/lib/prisma";
import { BarChart3, TrendingUp, Users, CalendarCheck, DollarSign, Building } from "lucide-react";

export default async function ReportsPage() {
  const [
    totalEmployees,
    departments,
    totalLeaves,
    approvedLeaves,
    totalAttendanceRecords,
    payrollRecords,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.department.findMany({
      include: {
        _count: { select: { employees: true } },
      },
    }),
    prisma.leaveRequest.count(),
    prisma.leaveRequest.count({ where: { status: "APPROVED" } }),
    prisma.attendanceRecord.count(),
    prisma.payrollRecord.findMany(),
  ]);

  const totalPayrollSpend = payrollRecords.reduce((acc, curr) => acc + curr.netSalary, 0);
  const leaveApprovalRate = totalLeaves > 0 ? Math.round((approvedLeaves / totalLeaves) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">HR Reports & Workforce Analytics</h2>
          <p className="text-xs text-slate-500">Executive metrics, department distribution, and financial summary</p>
        </div>
      </div>

      {/* Top Level KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Workforce</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalEmployees}</p>
            <span className="text-[10px] text-emerald-600 font-medium">Active Headcount</span>
          </div>
          <div className="p-3 rounded-xl text-blue-600 bg-blue-50">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Leave Approval Rate</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{leaveApprovalRate}%</p>
            <span className="text-[10px] text-slate-400">{approvedLeaves} of {totalLeaves} Approved</span>
          </div>
          <div className="p-3 rounded-xl text-emerald-600 bg-emerald-50">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Punches Logged</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{totalAttendanceRecords}</p>
            <span className="text-[10px] text-indigo-500 font-medium">All Time</span>
          </div>
          <div className="p-3 rounded-xl text-indigo-600 bg-indigo-50">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Cumulative Payroll</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">${totalPayrollSpend.toLocaleString()}</p>
            <span className="text-[10px] text-slate-400">{payrollRecords.length} Slips Disbursed</span>
          </div>
          <div className="p-3 rounded-xl text-emerald-600 bg-emerald-50">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-600" /> Headcount by Department
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
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operational Overview */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" /> Operational Health Index
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              System health and compliance are monitored continuously. All employee clock-in events are tied to verified browser sessions with timestamp validation.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-400">Database Engine</p>
              <p className="font-semibold text-slate-800 mt-0.5">PostgreSQL 18</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-400">Database Host</p>
              <p className="font-semibold text-slate-800 mt-0.5">Neon (Singapore)</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-400">Data Synchronization</p>
              <p className="font-semibold text-emerald-600 mt-0.5">Real-time (Prisma)</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-400">Architecture</p>
              <p className="font-semibold text-slate-800 mt-0.5">Modular SaaS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import { prisma } from "@/lib/prisma";
import { Users, Clock, CalendarCheck2, Building2, UserPlus } from "lucide-react";
import QuickPunch from "@/components/dashboard/QuickPunch";
import Link from "next/link";
import { getActiveCompanyId, employeeScope, departmentScope } from "@/lib/company";

export default async function DashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeCompanyId = await getActiveCompanyId();
  const employeeWhere = employeeScope(activeCompanyId);

  const [totalEmployees, totalDepartments, pendingLeaves, recentEmployees, adminEmployee, presentToday] =
    await Promise.all([
      prisma.employee.count({ where: employeeWhere }),
      prisma.department.count({ where: departmentScope(activeCompanyId) }),
      prisma.leaveRequest.count({ where: { status: "PENDING", employee: employeeWhere } }),
      prisma.employee.findMany({
        where: employeeWhere,
        take: 5,
        include: { department: true, designation: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.employee.findFirst(),
      prisma.attendanceRecord.count({
        where: { date: today, checkIn: { not: null }, employee: employeeWhere },
      }),
    ]);

  // QuickPunch is personal, so it reads the punching employee's own record rather than the company-wide count.
  const todayAttendance = adminEmployee
    ? await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId: adminEmployee.id, date: today } },
      })
    : null;

  const cards = [
    { label: "Total Employees", value: totalEmployees, icon: Users, color: "text-blue-600 bg-blue-50" },
    { label: "Departments", value: totalDepartments, icon: Building2, color: "text-emerald-600 bg-emerald-50" },
    { label: "Pending Leaves", value: pendingLeaves, icon: CalendarCheck2, color: "text-amber-600 bg-amber-50" },
    { label: "Today's Attendance", value: `${presentToday} / ${totalEmployees}`, icon: Clock, color: "text-indigo-600 bg-indigo-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">HR Operations Overview</h2>
          <p className="text-xs text-slate-500">Real-time workforce snapshot and quick actions</p>
        </div>
        <Link
          href="/dashboard/employees"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm"
        >
          <UserPlus className="w-4 h-4" /> Add Employee
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Hub: Quick Punch & Directory Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {adminEmployee && (
          <QuickPunch
            employeeId={adminEmployee.id}
            hasCheckedIn={Boolean(todayAttendance?.checkIn)}
            hasCheckedOut={Boolean(todayAttendance?.checkOut)}
            checkInTime={todayAttendance?.checkIn?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          />
        )}

        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Recent Employees</h3>
            <Link href="/dashboard/employees" className="text-xs text-indigo-600 hover:underline">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-y border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {emp.firstName} {emp.lastName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{emp.employeeCode}</td>
                    <td className="py-2.5 px-3 text-slate-600">{emp.department?.name ?? "N/A"}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600">
                        {emp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
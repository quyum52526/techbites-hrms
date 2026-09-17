import { prisma } from "@/lib/prisma";
import { Calendar, CheckCircle2, AlertCircle, UserCheck } from "lucide-react";
import { getActiveUser } from "@/lib/auth";
import { orgToday } from "@/lib/attendance-time";
import { getActiveCompanyId, employeeScope } from "@/lib/company";
import { importPunchLogsCsv } from "@/app/actions/attendance";
import CsvImportModal from "@/components/dashboard/CsvImportModal";

const ORG_TIME_ZONE = "Asia/Dhaka";

export default async function AttendancePage() {
  const today = orgToday();
  const [user, activeCompanyId] = await Promise.all([getActiveUser(), getActiveCompanyId()]);
  const canImport = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";
  // Attendance belongs to whichever company the employee is in; "All Companies" leaves this empty.
  const employeeWhere = employeeScope(activeCompanyId);

  const [attendances, totalEmployees, presentToday, lateToday] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { employee: employeeWhere },
      include: {
        employee: {
          include: {
            department: true,
            designation: true,
            user: true,
          },
        },
        shift: true,
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
    prisma.employee.count({ where: employeeWhere }),
    prisma.attendanceRecord.count({ where: { date: today, status: "PRESENT", employee: employeeWhere } }),
    prisma.attendanceRecord.count({ where: { date: today, status: "LATE", employee: employeeWhere } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Attendance & Shifts</h2>
          <p className="text-xs text-slate-500">Monitor employee punch logs, working hours, and shift adherence</p>
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

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Workforce</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalEmployees}</p>
          </div>
          <div className="p-3 rounded-xl text-blue-600 bg-blue-50">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Present Today</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{presentToday}</p>
          </div>
          <div className="p-3 rounded-xl text-emerald-600 bg-emerald-50">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Late Arrivals</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{lateToday}</p>
          </div>
          <div className="p-3 rounded-xl text-amber-600 bg-amber-50">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Attendance Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Attendance Logs</h3>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Recent Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Check In</th>
                <th className="py-3 px-4">Check Out</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No attendance logs recorded yet. Punch in from the dashboard to create logs.
                  </td>
                </tr>
              ) : (
                attendances.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {record.employee.firstName} {record.employee.lastName}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">{record.employee.employeeCode}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {/* DATE columns come back as UTC midnight, so format in UTC to avoid shifting the day. */}
                      {new Date(record.date).toLocaleDateString(undefined, { timeZone: "UTC" })}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {record.checkIn
                        ? new Date(record.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: ORG_TIME_ZONE })
                        : "--:--"}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {record.checkOut
                        ? new Date(record.checkOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: ORG_TIME_ZONE })
                        : "--:--"}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        record.status === "PRESENT" 
                          ? "bg-emerald-50 text-emerald-600" 
                          : record.status === "LATE" 
                          ? "bg-amber-50 text-amber-600" 
                          : "bg-rose-50 text-rose-600"
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {record.source}
                      </span>
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
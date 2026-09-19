import { EmployeeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { employeeScope, getActiveCompanyId } from "@/lib/company";
import PayPulseAttendanceTable from "@/components/dashboard/PayPulseAttendanceTable";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const today = new Date();
  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const companyId = await getActiveCompanyId();
  const employees = await prisma.employee.findMany({
    where: { ...employeeScope(companyId), status: { in: [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION, EmployeeStatus.NOTICE_PERIOD] } },
    include: { department: true, attendances: { where: { date: day }, select: { checkIn: true, checkOut: true, status: true } } },
    orderBy: { employeeCode: "asc" },
  });
  const rows = employees.map((employee) => {
    const record = employee.attendances[0];
    const hours = record?.checkIn && record.checkOut ? Math.max(0, record.checkOut.getTime() - record.checkIn.getTime()) / 3_600_000 : 0;
    return { employeeId: employee.id, code: employee.employeeCode, name: `${employee.firstName} ${employee.lastName}`, department: employee.department?.name ?? "Unassigned", date: day.toISOString().slice(0, 10), checkIn: record?.checkIn?.toISOString() ?? null, checkOut: record?.checkOut?.toISOString() ?? null, hours, status: record?.status ?? "ABSENT" };
  });
  return <div className="space-y-6"><div><h1 className="text-xl font-bold text-slate-900">Attendance</h1><p className="text-xs text-slate-600">Daily attendance with PayPulse-style filters and logged working hours</p></div><PayPulseAttendanceTable rows={rows} departments={[...new Set(rows.map((row) => row.department))].sort()} /></div>;
}

import { EmployeeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveCompanyId, employeeScope } from "@/lib/company";
import PayPulsePayrollTable from "@/components/dashboard/PayPulsePayrollTable";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const today = new Date();
  const month = today.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }).slice(0, 7);
  const year = today.getUTCFullYear();
  const monthNumber = today.getUTCMonth();
  const start = new Date(Date.UTC(year, monthNumber, 1));
  const end = new Date(Date.UTC(year, monthNumber + 1, 0, 23, 59, 59));
  const companyId = await getActiveCompanyId();
  const employees = await prisma.employee.findMany({
    where: { ...employeeScope(companyId), status: { in: [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION, EmployeeStatus.NOTICE_PERIOD] } },
    include: { department: true, salaryStructure: true, attendances: { where: { date: { gte: start, lte: end } }, select: { checkIn: true, checkOut: true, status: true } } },
    orderBy: { employeeCode: "asc" },
  });
  const rows = employees.map((employee) => {
    const salary = employee.salaryStructure;
    const loggedHours = employee.attendances.reduce((total, attendance) => total + (attendance.checkIn && attendance.checkOut ? Math.max(0, attendance.checkOut.getTime() - attendance.checkIn.getTime()) / 3_600_000 : 0), 0);
    const absentDays = employee.attendances.filter((attendance) => attendance.status === "ABSENT").length;
    const allowances = (salary?.houseRent ?? 0) + (salary?.medicalAllow ?? 0) + (salary?.otherAllow ?? 0);
    const deductions = (salary?.taxDeduction ?? 0) + (salary?.providentFund ?? 0) + (salary?.basicSalary ?? 0) / 30 * absentDays;
    const gross = (salary?.basicSalary ?? 0) + allowances;
    return { employeeId: employee.id, code: employee.employeeCode, name: `${employee.firstName} ${employee.lastName}`, department: employee.department?.name ?? "Unassigned", payModel: employee.employmentType === "PART_TIME" ? "HOURLY" as const : "MONTHLY" as const, loggedValue: employee.employmentType === "PART_TIME" ? Number(loggedHours.toFixed(2)) : employee.attendances.filter((attendance) => attendance.checkIn).length, loggedUnit: employee.employmentType === "PART_TIME" ? "hrs" : "days", gross, deductions, net: Math.max(0, gross - deductions), status: "PENDING" as const };
  });
  return <div className="space-y-6"><div><h1 className="text-xl font-bold text-slate-900">Payroll</h1><p className="text-xs text-slate-600">PayPulse payroll register with logged metrics and pending approvals · {month}</p></div><PayPulsePayrollTable rows={rows} departments={[...new Set(rows.map((row) => row.department))].sort()} month={month} /></div>;
}

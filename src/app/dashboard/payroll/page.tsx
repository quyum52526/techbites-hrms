import { EmployeeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { employeeScopeForCompanies, getAccessibleCompanyIds } from "@/lib/company";
import PayPulsePayrollTable from "@/components/dashboard/PayPulsePayrollTable";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const today = new Date();
  const month = today.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }).slice(0, 7);
  const year = today.getUTCFullYear();
  const monthNumber = today.getUTCMonth();
  const start = new Date(Date.UTC(year, monthNumber, 1));
  const end = new Date(Date.UTC(year, monthNumber + 1, 0, 23, 59, 59));
  const accessibleCompanyIds = await getAccessibleCompanyIds();
  const companies = await prisma.company.findMany({
    where: accessibleCompanyIds ? { id: { in: accessibleCompanyIds } } : undefined,
    select: { id: true, name: true },
    orderBy: [{ type: "asc" }, { parentId: "asc" }, { name: "asc" }],
  });
  const employees = await prisma.employee.findMany({
      where: { ...employeeScopeForCompanies(accessibleCompanyIds ?? companies.map(({ id }) => id)), status: { in: [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION, EmployeeStatus.NOTICE_PERIOD] } },
      include: { company: { select: { id: true, name: true } }, department: true, salaryStructure: true, attendances: { where: { date: { gte: start, lte: end } }, select: { checkIn: true, checkOut: true, status: true } } },
      orderBy: { employeeCode: "asc" },
    });
  const rows = employees.map((employee) => {
    const salary = employee.salaryStructure;
    const loggedHours = employee.attendances.reduce((total, attendance) => total + (attendance.checkIn && attendance.checkOut ? Math.max(0, attendance.checkOut.getTime() - attendance.checkIn.getTime()) / 3_600_000 : 0), 0);
    const absentDays = employee.attendances.filter((attendance) => attendance.status === "ABSENT").length;
    const allowances = (salary?.houseRent ?? 0) + (salary?.medicalAllow ?? 0) + (salary?.otherAllow ?? 0);
    const deductions = (salary?.taxDeduction ?? 0) + (salary?.providentFund ?? 0) + (salary?.basicSalary ?? 0) / 30 * absentDays;
    const gross = (salary?.basicSalary ?? 0) + allowances;
    return { employeeId: employee.id, companyId: employee.companyId, company: employee.company?.name ?? "Unassigned", code: employee.employeeCode, name: `${employee.firstName} ${employee.lastName}`, department: employee.department?.name ?? "Unassigned", payModel: employee.employmentType === "PART_TIME" ? "HOURLY" as const : "MONTHLY" as const, loggedValue: employee.employmentType === "PART_TIME" ? Number(loggedHours.toFixed(2)) : employee.attendances.filter((attendance) => attendance.checkIn).length, loggedUnit: employee.employmentType === "PART_TIME" ? "hrs" : "days", gross, deductions, net: Math.max(0, gross - deductions), status: "PENDING" as const };
  });
  return <div className="space-y-6"><div><h1 className="text-xl font-bold text-slate-900">Payroll</h1><p className="text-xs text-slate-600">PayPulse payroll register with logged metrics and pending approvals · {month}</p></div><PayPulsePayrollTable rows={rows} companies={companies} month={month} /></div>;
}

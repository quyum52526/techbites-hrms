import { EmployeeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveUser, isHRAdmin } from "@/lib/auth";
import { employeeScopeForCompanies, getAccessibleCompanyIds } from "@/lib/company";
import { festivalBonusFor, type FestivalBonusPolicyView } from "@/lib/festival-bonus";
import { parsePeriodParam, periodDateRange, periodLabel, periodParam, type PayrollPeriod } from "@/lib/payroll";
import { payrollTotals } from "@/lib/payroll-deductions";
import FestivalBonusPanel from "@/components/dashboard/FestivalBonusPanel";
import PayPulsePayrollTable, { type PayrollRow } from "@/components/dashboard/PayPulsePayrollTable";
import PayrollPeriodPicker from "@/components/dashboard/PayrollPeriodPicker";

export const dynamic = "force-dynamic";

/** The current payroll month in organisation time (Asia/Dhaka). */
function currentPeriod(): PayrollPeriod {
  const [year, month] = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }).split("-").map(Number);
  return { year, month };
}

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const [{ period: requested }, user] = await Promise.all([searchParams, getActiveUser()]);
  const period = parsePeriodParam(requested) ?? currentPeriod();
  const { start, end } = periodDateRange(period);

  const accessibleCompanyIds = await getAccessibleCompanyIds(user);
  const companies = await prisma.company.findMany({
    where: accessibleCompanyIds ? { id: { in: accessibleCompanyIds } } : undefined,
    select: { id: true, name: true },
    orderBy: [{ type: "asc" }, { parentId: "asc" }, { name: "asc" }],
  });
  const companyIds = accessibleCompanyIds ?? companies.map(({ id }) => id);

  const [employees, policyRecords, deductionRecords] = await Promise.all([
    prisma.employee.findMany({
      where: { ...employeeScopeForCompanies(companyIds), status: { in: [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION, EmployeeStatus.NOTICE_PERIOD] } },
      include: { company: { select: { id: true, name: true } }, department: true, salaryStructure: true, attendances: { where: { date: { gte: start, lte: end } }, select: { checkIn: true, checkOut: true, status: true } } },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.festivalBonusPolicy.findMany({
      where: { year: period.year, companyId: { in: companyIds } },
      select: { companyId: true, year: true, targetBasis: true, percentage: true, payoutMonths: true, enabled: true },
    }),
    prisma.payrollDeduction.findMany({
      // By the employee's current company, so an entry follows an employee who later moves company.
      where: { period: periodParam(period), employee: employeeScopeForCompanies(companyIds) },
      select: { employeeId: true, advanceDeduction: true, demurrageClaim: true, remarks: true },
    }),
  ]);
  const deductionByEmployee = new Map(deductionRecords.map((deduction) => [deduction.employeeId, deduction]));
  const policies: FestivalBonusPolicyView[] = policyRecords;
  const policyByCompany = new Map(policies.map((policy) => [policy.companyId, policy]));

  const rows: PayrollRow[] = employees.map((employee) => {
    const salary = employee.salaryStructure;
    const basicSalary = salary?.basicSalary ?? 0;
    const loggedHours = employee.attendances.reduce((total, attendance) => total + (attendance.checkIn && attendance.checkOut ? Math.max(0, attendance.checkOut.getTime() - attendance.checkIn.getTime()) / 3_600_000 : 0), 0);
    const absentDays = employee.attendances.filter((attendance) => attendance.status === "ABSENT").length;
    const allowances = (salary?.houseRent ?? 0) + (salary?.medicalAllow ?? 0) + (salary?.otherAllow ?? 0);
    // Tax, PF and unpaid-absence deduction; advance and demurrage come from this month's PayrollDeduction entry.
    const baseDeductions = (salary?.taxDeduction ?? 0) + (salary?.providentFund ?? 0) + basicSalary / 30 * absentDays;
    const oneOff = deductionByEmployee.get(employee.id);
    const regularGross = basicSalary + allowances;
    // Festival bonus from the employee's company policy; null outside its payout months or without a salary.
    const bonus = salary && employee.companyId ? festivalBonusFor(policyByCompany.get(employee.companyId), period, { basicSalary, regularEarnings: regularGross }) : null;
    const totals = payrollTotals({
      regularGross,
      festivalBonus: bonus?.amount ?? 0,
      baseDeductions,
      advanceDeduction: oneOff?.advanceDeduction ?? 0,
      demurrageClaim: oneOff?.demurrageClaim ?? 0,
    });
    return {
      employeeId: employee.id,
      companyId: employee.companyId,
      company: employee.company?.name ?? "Unassigned",
      code: employee.employeeCode,
      name: `${employee.firstName} ${employee.lastName}`,
      department: employee.department?.name ?? "Unassigned",
      payModel: employee.employmentType === "PART_TIME" ? "HOURLY" as const : "MONTHLY" as const,
      loggedValue: employee.employmentType === "PART_TIME" ? Number(loggedHours.toFixed(2)) : employee.attendances.filter((attendance) => attendance.checkIn).length,
      loggedUnit: employee.employmentType === "PART_TIME" ? "hrs" : "days",
      regularGross,
      festivalBonus: bonus?.amount ?? 0,
      festivalBonusFormula: bonus?.label ?? null,
      gross: totals.gross,
      baseDeductions,
      advanceDeduction: oneOff?.advanceDeduction ?? 0,
      demurrageClaim: oneOff?.demurrageClaim ?? 0,
      deductionRemarks: oneOff?.remarks ?? null,
      deductions: totals.totalDeductions,
      net: totals.net,
      status: "PENDING" as const,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payroll</h1>
          <p className="text-xs text-slate-600">PayPulse payroll register with logged metrics and pending approvals · {periodLabel(period)}</p>
        </div>
        <PayrollPeriodPicker value={periodParam(period)} />
      </div>
      <FestivalBonusPanel companies={companies} policies={policies} period={period} canConfigure={isHRAdmin(user.role)} />
      <PayPulsePayrollTable rows={rows} companies={companies} month={periodParam(period)} canEditDeductions={isHRAdmin(user.role)} />
    </div>
  );
}

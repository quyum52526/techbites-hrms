"use server";

import { AttendanceStatus, EmployeeStatus, PayrollStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveUser } from "@/lib/auth";
import { getActiveCompanyId, employeeScope } from "@/lib/company";
import { calculatePayroll, isValidPeriod, periodDateRange, periodLabel } from "@/lib/payroll";

export type PayrollActionResult = { ok: true; message: string } | { ok: false; error: string };

async function requirePayrollAdmin() {
  const user = await getActiveUser();
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.HR_ADMIN) {
    throw new Error("You do not have permission to manage payroll");
  }
  return user;
}

/** Blocks payroll changes for employees outside the company selected in the switcher. */
async function getEmployeeInActiveCompany(employeeId: string) {
  const [employee, activeCompanyId] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, companyId: true } }),
    getActiveCompanyId(),
  ]);
  if (!employee) throw new Error("Employee not found");
  if (activeCompanyId && employee.companyId !== activeCompanyId) {
    throw new Error("Employee does not belong to the selected company");
  }
  return employee;
}

const salaryFieldLabels = {
  basicSalary: "basic salary",
  houseRent: "house rent",
  medicalAllow: "medical allowance",
  otherAllow: "other allowances",
  taxDeduction: "income tax",
  providentFund: "provident fund",
} as const;

type SalaryFields = Record<keyof typeof salaryFieldLabels, number>;

/** Blank amounts count as 0; anything else must be a non-negative number. */
function parseSalary(formData: FormData): SalaryFields | { error: string } {
  const salary = {} as SalaryFields;
  for (const [key, label] of Object.entries(salaryFieldLabels) as [keyof SalaryFields, string][]) {
    const value = Number(formData.get(key) || 0);
    if (!Number.isFinite(value) || value < 0) return { error: `Enter a valid, non-negative amount for ${label}` };
    salary[key] = value;
  }
  return salary;
}

/** `useActionState` action: validation problems come back as `{ ok: false }`, missing permission throws. */
export async function setSalaryStructure(_prev: PayrollActionResult | null, formData: FormData): Promise<PayrollActionResult> {
  await requirePayrollAdmin();

  const employeeId = formData.get("employeeId");
  if (typeof employeeId !== "string" || !employeeId) return { ok: false, error: "Choose an employee" };
  if (!formData.get("basicSalary")) return { ok: false, error: "Enter a basic salary" };

  const salary = parseSalary(formData);
  if ("error" in salary) return { ok: false, error: salary.error };

  try {
    await getEmployeeInActiveCompany(employeeId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Employee not found" };
  }

  await prisma.salaryStructure.upsert({
    where: { employeeId },
    create: { employeeId, ...salary },
    update: salary,
  });

  revalidatePath("/dashboard/payroll");
  return { ok: true, message: "Saved successfully" };
}

/**
 * Generates (or regenerates) payroll for every active employee with a salary structure.
 * - Scope: `companyId`, else the company selected in the top bar, else all companies.
 * - Records already marked PAID are left untouched, so re-running a month is safe.
 * - Late/absent fines come from that month's attendance records (see PAYROLL_POLICY).
 */
export async function generatePayroll(month: number, year: number, companyId?: string): Promise<PayrollActionResult> {
  await requirePayrollAdmin();

  const period = { month, year };
  if (!isValidPeriod(period)) return { ok: false, error: "Choose a valid payroll month" };

  const activeCompanyId = await getActiveCompanyId();
  if (companyId && activeCompanyId && companyId !== activeCompanyId) {
    return { ok: false, error: "That company is not the one selected in the top bar" };
  }
  const scopeCompanyId = companyId ?? activeCompanyId;
  if (scopeCompanyId) {
    const company = await prisma.company.findUnique({ where: { id: scopeCompanyId }, select: { id: true } });
    if (!company) return { ok: false, error: "Selected company no longer exists" };
  }

  const label = periodLabel(period);
  const { start, end } = periodDateRange(period);

  const employees = await prisma.employee.findMany({
    where: {
      ...employeeScope(scopeCompanyId),
      status: { notIn: [EmployeeStatus.TERMINATED, EmployeeStatus.RESIGNED] },
      joiningDate: { lt: new Date(end.getTime() + 24 * 60 * 60 * 1000) },
    },
    select: { id: true, companyId: true, salaryStructure: true },
  });

  const payable = employees.filter((e) => e.salaryStructure);
  const missingSalary = employees.length - payable.length;
  if (payable.length === 0) {
    return {
      ok: false,
      error: employees.length === 0
        ? `No active employees found for ${label}`
        : `None of the ${employees.length} active employee(s) have a salary structure yet`,
    };
  }

  const employeeIds = payable.map((e) => e.id);
  const [paidRecords, attendanceCounts] = await Promise.all([
    prisma.payrollRecord.findMany({
      where: { month: label, employeeId: { in: employeeIds }, status: PayrollStatus.PAID },
      select: { employeeId: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["employeeId", "status"],
      where: {
        employeeId: { in: employeeIds },
        date: { gte: start, lte: end },
        status: { in: [AttendanceStatus.LATE, AttendanceStatus.ABSENT] },
      },
      _count: { _all: true },
    }),
  ]);

  const paid = new Set(paidRecords.map((r) => r.employeeId));
  const countFor = (employeeId: string, status: AttendanceStatus) =>
    attendanceCounts.find((c) => c.employeeId === employeeId && c.status === status)?._count._all ?? 0;

  const toGenerate = payable.filter((e) => !paid.has(e.id));
  await prisma.$transaction(
    async (tx) => {
      for (const employee of toGenerate) {
        const data = {
          ...calculatePayroll(employee.salaryStructure!, {
            lateDays: countFor(employee.id, AttendanceStatus.LATE),
            absentDays: countFor(employee.id, AttendanceStatus.ABSENT),
          }),
          // companyId is snapshotted so historic pay-slips stay with the company that paid them.
          companyId: employee.companyId,
          status: PayrollStatus.GENERATED,
          paymentDate: null,
        };
        await tx.payrollRecord.upsert({
          where: { employeeId_month: { employeeId: employee.id, month: label } },
          create: { employeeId: employee.id, month: label, ...data },
          update: data,
        });
      }
    },
    { timeout: 120_000, maxWait: 10_000 }
  );

  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/reports");

  const notes = [
    paid.size > 0 && `${paid.size} already paid (unchanged)`,
    missingSalary > 0 && `${missingSalary} skipped — no salary structure`,
  ].filter(Boolean);
  return {
    ok: true,
    message: `Generated ${toGenerate.length} pay-slip(s) for ${label}${notes.length ? ` · ${notes.join(" · ")}` : ""}`,
  };
}

export async function updatePayrollStatus(recordId: string, status: PayrollStatus): Promise<PayrollActionResult> {
  await requirePayrollAdmin();
  if (!Object.values(PayrollStatus).includes(status)) return { ok: false, error: "Unknown payroll status" };

  const [record, activeCompanyId] = await Promise.all([
    prisma.payrollRecord.findUnique({
      where: { id: recordId },
      select: { status: true, paymentDate: true, companyId: true, employee: { select: { companyId: true } } },
    }),
    getActiveCompanyId(),
  ]);
  if (!record) return { ok: false, error: "Payroll record not found" };
  if (activeCompanyId && (record.companyId ?? record.employee.companyId) !== activeCompanyId) {
    return { ok: false, error: "This payroll record belongs to a different company" };
  }

  await prisma.payrollRecord.update({
    where: { id: recordId },
    data: {
      status,
      // Keep the original payment date if it was already paid; clear it when un-marking.
      paymentDate: status === PayrollStatus.PAID ? record.paymentDate ?? new Date() : null,
    },
  });

  revalidatePath("/dashboard/payroll");
  revalidatePath("/dashboard/reports");
  return { ok: true, message: `Marked as ${status}` };
}

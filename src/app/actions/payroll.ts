"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveCompanyId } from "@/lib/company";

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

export async function setSalaryStructure(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const basicSalary = parseFloat(formData.get("basicSalary") as string);
  const houseRent = parseFloat((formData.get("houseRent") as string) || "0");
  const medicalAllow = parseFloat((formData.get("medicalAllow") as string) || "0");
  const taxDeduction = parseFloat((formData.get("taxDeduction") as string) || "0");

  if (!employeeId || isNaN(basicSalary)) throw new Error("Invalid salary parameters");
  await getEmployeeInActiveCompany(employeeId);

  await prisma.salaryStructure.upsert({
    where: { employeeId },
    create: { employeeId, basicSalary, houseRent, medicalAllow, taxDeduction },
    update: { basicSalary, houseRent, medicalAllow, taxDeduction },
  });

  revalidatePath("/dashboard/payroll");
}

export async function generatePayslip(employeeId: string, month: string) {
  const employee = await getEmployeeInActiveCompany(employeeId);

  const structure = await prisma.salaryStructure.findUnique({ where: { employeeId } });
  if (!structure) throw new Error("Salary structure not defined for employee");

  const allowances = structure.houseRent + structure.medicalAllow + structure.otherAllow;
  const deductions = structure.taxDeduction;
  const netSalary = structure.basicSalary + allowances - deductions;

  // companyId is snapshotted so historic payslips stay with the company that paid them.
  await prisma.payrollRecord.upsert({
    where: { employeeId_month: { employeeId, month } },
    create: {
      employeeId,
      companyId: employee.companyId,
      month,
      basicSalary: structure.basicSalary,
      allowances,
      deductions,
      netSalary,
      status: "GENERATED",
    },
    update: {
      companyId: employee.companyId,
      basicSalary: structure.basicSalary,
      allowances,
      deductions,
      netSalary,
      status: "GENERATED",
    },
  });

  revalidatePath("/dashboard/payroll");
}

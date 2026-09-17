"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function setSalaryStructure(formData: FormData) {
  const employeeId = formData.get("employeeId") as string;
  const basicSalary = parseFloat(formData.get("basicSalary") as string);
  const houseRent = parseFloat((formData.get("houseRent") as string) || "0");
  const medicalAllow = parseFloat((formData.get("medicalAllow") as string) || "0");
  const taxDeduction = parseFloat((formData.get("taxDeduction") as string) || "0");

  if (!employeeId || isNaN(basicSalary)) throw new Error("Invalid salary parameters");

  await prisma.salaryStructure.upsert({
    where: { employeeId },
    create: { employeeId, basicSalary, houseRent, medicalAllow, taxDeduction },
    update: { basicSalary, houseRent, medicalAllow, taxDeduction },
  });

  revalidatePath("/dashboard/payroll");
}

export async function generatePayslip(employeeId: string, month: string) {
  const structure = await prisma.salaryStructure.findUnique({ where: { employeeId } });
  if (!structure) throw new Error("Salary structure not defined for employee");

  const allowances = structure.houseRent + structure.medicalAllow + structure.otherAllow;
  const deductions = structure.taxDeduction;
  const netSalary = structure.basicSalary + allowances - deductions;

  await prisma.payrollRecord.upsert({
    where: { employeeId_month: { employeeId, month } },
    create: {
      employeeId,
      month,
      basicSalary: structure.basicSalary,
      allowances,
      deductions,
      netSalary,
      status: "GENERATED",
    },
    update: {
      basicSalary: structure.basicSalary,
      allowances,
      deductions,
      netSalary,
      status: "GENERATED",
    },
  });

  revalidatePath("/dashboard/payroll");
}
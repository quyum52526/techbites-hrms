"use server";

import { EmploymentType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { getActiveUser } from "@/lib/auth";
import { getActiveCompanyId } from "@/lib/company";
import { readCsvRecords } from "@/lib/csv";
import { readUploadedCsv, type ImportIssue, type ImportResult } from "@/lib/import-result";

export type EmployeeActionResult = { ok: true } | { ok: false; error: string };

const duplicateFieldLabels: Record<string, string> = {
  email: "work email",
  employeeCode: "employee code",
  biometricId: "biometric / device ID",
};

export async function createEmployee(formData: FormData): Promise<EmployeeActionResult> {
  const user = await getActiveUser();
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.HR_ADMIN) {
    return { ok: false, error: "You do not have permission to create employees" };
  }

  const email = (formData.get("email") as string)?.trim();
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const employeeCode = (formData.get("employeeCode") as string)?.trim();
  const phone = formData.get("phone") as string;
  const companyId = (formData.get("companyId") as string) || null;
  const biometricId = (formData.get("biometricId") as string)?.trim() || null;
  const departmentId = (formData.get("departmentId") as string) || null;
  const designationId = formData.get("designationId") as string;
  const employmentType = (formData.get("employmentType") as EmploymentType | null) ?? EmploymentType.FULL_TIME;

  if (!email || !firstName || !lastName || !employeeCode) {
    return { ok: false, error: "Required fields are missing" };
  }

  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return { ok: false, error: "Selected company no longer exists" };
  }

  if (departmentId) {
    const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { companyId: true } });
    if (!department) return { ok: false, error: "Selected department no longer exists" };
    if (department.companyId && department.companyId !== companyId) {
      return { ok: false, error: "Selected department belongs to a different company" };
    }
  }

  // ডিফল্ট পাসওয়ার্ড দিয়ে ইউজার তৈরি
  const passwordHash = await bcrypt.hash("Welcome123!", 10);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: "EMPLOYEE",
        },
      });

      await tx.employee.create({
        data: {
          userId: user.id,
          employeeCode,
          biometricId,
          companyId,
          firstName,
          lastName,
          phone,
          departmentId,
          designationId: designationId || null,
          employmentType,
          status: "ACTIVE",
          joiningDate: new Date(),
        },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const fields = (err.meta?.target as string[] | undefined) ?? [];
      const label = fields.map((f) => duplicateFieldLabels[f] ?? f).join(", ") || "value";
      return { ok: false, error: `An employee with this ${label} already exists` };
    }
    throw err;
  }

  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");
  return { ok: true };
}

const MAX_EMPLOYEE_IMPORT_ROWS = 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Bulk-creates employees from a CSV with columns:
 * firstName, lastName, email, employeeCode, companyCode, department, designation, phone, biometricId.
 * Every row is validated first; if any row fails, nothing is written.
 */
export async function importEmployeesCsv(formData: FormData): Promise<ImportResult> {
  const fail = (message: string, issues: ImportIssue[] = []): ImportResult => ({ ok: false, message, stats: [], issues });

  const user = await getActiveUser();
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.HR_ADMIN) {
    return fail("You do not have permission to import employees");
  }

  const upload = await readUploadedCsv(formData);
  if (!upload.ok) return upload.result;

  const parsed = readCsvRecords(upload.text, ["firstName", "lastName", "email", "employeeCode"]);
  if (!parsed.ok) return fail(parsed.error);
  if (parsed.records.length > MAX_EMPLOYEE_IMPORT_ROWS) {
    return fail(`A single import is limited to ${MAX_EMPLOYEE_IMPORT_ROWS} employees; this file has ${parsed.records.length}`);
  }

  const [activeCompanyId, companies, departments, designations] = await Promise.all([
    getActiveCompanyId(),
    prisma.company.findMany({ select: { id: true, code: true, name: true } }),
    prisma.department.findMany({ select: { id: true, name: true, companyId: true } }),
    prisma.designation.findMany({ select: { id: true, title: true } }),
  ]);
  const companyByCode = new Map(companies.map((c) => [c.code.toUpperCase(), c]));
  const designationByTitle = new Map(designations.map((d) => [d.title.toLowerCase(), d]));

  const issues: ImportIssue[] = [];
  const seen = { email: new Map<string, number>(), employeeCode: new Map<string, number>(), biometricId: new Map<string, number>() };
  const rows: {
    line: number;
    email: string;
    employee: Omit<Prisma.EmployeeCreateManyInput, "joiningDate" | "userId"> & { biometricId: string | null };
  }[] = [];

  for (const { line, values } of parsed.records) {
    const issue = (message: string) => issues.push({ line, message });
    const firstName = values.firstname;
    const lastName = values.lastname;
    const email = values.email;
    const employeeCode = values.employeecode;
    const biometricId = values.biometricid || null;
    const rowIssueCount = issues.length;

    if (!firstName || !lastName) issue("firstName and lastName are required");
    if (!employeeCode) issue("employeeCode is required");
    if (!email) issue("email is required");
    else if (!EMAIL_PATTERN.test(email)) issue(`"${email}" is not a valid email`);

    for (const [key, value] of [["email", email?.toLowerCase()], ["employeeCode", employeeCode], ["biometricId", biometricId]] as const) {
      if (!value) continue;
      const firstLine = seen[key].get(value);
      if (firstLine) issue(`Duplicate ${key} "${value}" (also on line ${firstLine})`);
      else seen[key].set(value, line);
    }

    // A blank companyCode falls back to the company selected in the switcher.
    let companyId = activeCompanyId;
    if (values.companycode) {
      const company = companyByCode.get(values.companycode.toUpperCase());
      if (!company) issue(`Unknown companyCode "${values.companycode}"`);
      else if (activeCompanyId && company.id !== activeCompanyId) {
        issue(`companyCode "${company.code}" is outside the currently selected company — switch to All Companies to import it`);
      } else companyId = company.id;
    }

    let departmentId: string | null = null;
    if (values.department) {
      const matches = departments.filter((d) => d.name.toLowerCase() === values.department.toLowerCase());
      const department = matches.find((d) => !d.companyId || d.companyId === companyId);
      if (matches.length === 0) issue(`Unknown department "${values.department}"`);
      else if (!department) issue(`Department "${values.department}" belongs to a different company`);
      else departmentId = department.id;
    }

    let designationId: string | null = null;
    if (values.designation) {
      const designation = designationByTitle.get(values.designation.toLowerCase());
      if (!designation) issue(`Unknown designation "${values.designation}"`);
      else designationId = designation.id;
    }

    if (issues.length === rowIssueCount) {
      rows.push({
        line,
        email,
        employee: {
          employeeCode,
          biometricId,
          companyId,
          departmentId,
          designationId,
          firstName,
          lastName,
          phone: values.phone || null,
          employmentType: EmploymentType.FULL_TIME,
          status: "ACTIVE",
        },
      });
    }
  }

  // Conflicts with records already in the database.
  if (rows.length > 0) {
    const [existingUsers, existingEmployees] = await Promise.all([
      prisma.user.findMany({
        where: { email: { in: rows.map((r) => r.email), mode: "insensitive" } },
        select: { email: true },
      }),
      prisma.employee.findMany({
        where: {
          OR: [
            { employeeCode: { in: rows.map((r) => r.employee.employeeCode) } },
            { biometricId: { in: rows.flatMap((r) => (r.employee.biometricId ? [r.employee.biometricId] : [])) } },
          ],
        },
        select: { employeeCode: true, biometricId: true },
      }),
    ]);
    const takenEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
    const takenCodes = new Set(existingEmployees.map((e) => e.employeeCode));
    const takenBiometric = new Set(existingEmployees.flatMap((e) => (e.biometricId ? [e.biometricId] : [])));

    for (const { line, email, employee } of rows) {
      if (takenEmails.has(email.toLowerCase())) issues.push({ line, message: `A user with email "${email}" already exists` });
      if (takenCodes.has(employee.employeeCode)) issues.push({ line, message: `Employee code "${employee.employeeCode}" already exists` });
      if (employee.biometricId && takenBiometric.has(employee.biometricId)) {
        issues.push({ line, message: `Biometric ID "${employee.biometricId}" is already assigned to another employee` });
      }
    }
  }

  if (issues.length > 0) {
    issues.sort((a, b) => a.line - b.line);
    return fail(`No employees were imported. Fix the ${issues.length} issue(s) below and upload again.`, issues);
  }

  // Every imported account starts with the same default password as single creation, so one hash serves all rows.
  const passwordHash = await bcrypt.hash("Welcome123!", 10);
  const joiningDate = new Date();
  const withUserIds = rows.map(({ email, employee }) => ({ userId: randomUUID(), email, employee }));

  try {
    // Two batched inserts in one transaction: all rows land or none do.
    await prisma.$transaction([
      prisma.user.createMany({
        data: withUserIds.map(({ userId, email }) => ({ id: userId, email, passwordHash, role: Role.EMPLOYEE })),
      }),
      prisma.employee.createMany({
        data: withUserIds.map(({ userId, employee }) => ({ ...employee, userId, joiningDate })),
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail("No employees were imported: a duplicate email, employee code or biometric ID was added while importing. Upload again to see which row.");
    }
    throw err;
  }

  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message: `Imported ${rows.length} employee(s). Default password: Welcome123!`,
    stats: [{ label: "Employees created", value: rows.length }],
    issues: [],
  };
}

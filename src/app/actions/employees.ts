"use server";

import { EmployeeStatus, EmploymentType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { assignableRoles, canChangeRole, getWritableUser, guestWriteResult, isHRAdmin, roleLabels } from "@/lib/auth";
import { GUEST_READ_ONLY_MESSAGE } from "@/lib/auth-shared";
import { getAccessibleCompanyIds, getActiveCompanyId, WORKFORCE_STATUSES } from "@/lib/company";
import { readCsvRecords } from "@/lib/csv";
import { readUploadedCsv, type ImportIssue, type ImportResult } from "@/lib/import-result";
import { BLOOD_GROUPS, isSeparated, toDateInputValue } from "@/lib/employee-profile";
import { readEmployeeImages, saveEmployeeImages } from "@/lib/employee-files";
import { calculateSettlement, parseDateInput, type ReleaseInput } from "@/lib/settlement";

export type EmployeeActionResult = { ok: true } | { ok: false; error: string };

const duplicateFieldLabels: Record<string, string> = {
  email: "work email",
  employeeCode: "employee code",
  biometricId: "biometric / device ID",
};

const ROLES = Object.values(Role);
const MAX_REPORTING_DEPTH = 50;

/**
 * Checks a "Reports to" choice. The manager must be on the workforce (unless unchanged), cannot be the employee,
 * and cannot be someone who already reports up to the employee, which would make a reporting loop.
 */
async function validateManager(managerId: string | null, employeeId: string | null, currentManagerId: string | null = null, companyId: string | null = null) {
  if (!managerId) return null;
  if (managerId === employeeId) return "An employee cannot report to themselves";

  const manager = await prisma.employee.findUnique({ where: { id: managerId }, select: { status: true, managerId: true, companyId: true } });
  if (!manager) return "Selected manager no longer exists";
  if (companyId && manager.companyId !== companyId) return "Selected manager belongs to a different company";
  if (managerId !== currentManagerId && !WORKFORCE_STATUSES.includes(manager.status)) {
    return "Selected manager is no longer on the workforce";
  }

  if (employeeId) {
    let cursor = manager.managerId;
    for (let depth = 0; cursor && depth < MAX_REPORTING_DEPTH; depth++) {
      if (cursor === employeeId) return "That manager already reports to this employee; choosing them would create a reporting loop";
      cursor = (await prisma.employee.findUnique({ where: { id: cursor }, select: { managerId: true } }))?.managerId ?? null;
    }
  }
  return null;
}

const parseRole = (value: FormDataEntryValue | null): Role | null =>
  typeof value === "string" && (ROLES as string[]).includes(value) ? (value as Role) : null;

export async function createEmployee(formData: FormData): Promise<EmployeeActionResult> {
  const user = await getWritableUser();
  if (!user) return guestWriteResult;
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.HR_ADMIN) {
    return { ok: false, error: "You do not have permission to create employees" };
  }

  const email = (formData.get("email") as string)?.trim();
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const employeeCode = (formData.get("employeeCode") as string)?.trim();
  const phone = formData.get("phone") as string;
  let companyId = (formData.get("companyId") as string) || null;
  const biometricId = (formData.get("biometricId") as string)?.trim() || null;
  const departmentId = (formData.get("departmentId") as string) || null;
  const designationId = formData.get("designationId") as string;
  const employmentType = (formData.get("employmentType") as EmploymentType | null) ?? EmploymentType.FULL_TIME;
  const joiningDate = parseDateInput(formData.get("joiningDate") as string | null);
  const today = parseDateInput(toDateInputValue(new Date()))!;
  const accessibleCompanyIds = await getAccessibleCompanyIds(user);
  const referenceName = (formData.get("referenceName") as string)?.trim() || null;
  const referencePhone = (formData.get("referencePhone") as string)?.trim() || null;
  const referenceRelation = (formData.get("referenceRelation") as string)?.trim() || null;

  if (!email || !firstName || !lastName || !employeeCode) {
    return { ok: false, error: "Required fields are missing" };
  }
  if (!joiningDate) return { ok: false, error: "Enter a valid joining date" };
  if (joiningDate > today) return { ok: false, error: "Joining date cannot be in the future" };

  const role = formData.has("role") ? parseRole(formData.get("role")) : Role.EMPLOYEE;
  if (!role) return { ok: false, error: "Select a valid system role" };
  if (!assignableRoles(user.role).includes(role)) {
    return { ok: false, error: `You cannot grant the ${roleLabels[role]} role` };
  }
  const managerId = (formData.get("managerId") as string | null) || null;
  if (user.role !== Role.SUPER_ADMIN) {
    if (!user.companyId) return { ok: false, error: "Your account is not assigned to a company" };
    if (companyId && accessibleCompanyIds && !accessibleCompanyIds.includes(companyId)) return { ok: false, error: "You cannot create an employee outside your company group" };
    companyId = companyId || user.companyId;
  }
  const managerError = await validateManager(managerId, null, null, companyId);
  if (managerError) return { ok: false, error: managerError };

  const images = await readEmployeeImages(formData);
  if (!images.ok) return images;

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
          role,
        },
      });

      const employee = await tx.employee.create({
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
          managerId,
          employmentType,
          status: "ACTIVE",
          joiningDate,
          referenceName,
          referencePhone,
          referenceRelation,
        },
        select: { id: true },
      });

      if (images.images.length > 0) {
        const urls = await saveEmployeeImages(tx, employee.id, images.images);
        await tx.employee.update({ where: { id: employee.id }, data: urls });
      }
    }, { timeout: 15_000 });
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

  const user = await getWritableUser();
  if (!user) return fail(GUEST_READ_ONLY_MESSAGE);
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

const EMPLOYMENT_TYPES = Object.values(EmploymentType);
/** Statuses the edit form may set. TERMINATED / RESIGNED only come from processing a release. */
const EDITABLE_STATUSES: EmployeeStatus[] = [EmployeeStatus.ACTIVE, EmployeeStatus.PROBATION, EmployeeStatus.NOTICE_PERIOD];

const textField = (formData: FormData, name: string) => (formData.get(name) as string | null)?.trim() || null;

export async function updateEmployee(employeeId: string, formData: FormData): Promise<EmployeeActionResult> {
  const user = await getWritableUser();
  if (!user) return guestWriteResult;
  if (!isHRAdmin(user.role)) {
    return { ok: false, error: "You do not have permission to edit employees" };
  }

  const existing = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { status: true, userId: true, managerId: true, companyId: true, photoUrl: true, nidScanUrl: true, user: { select: { role: true } } },
  });
  if (!existing) return { ok: false, error: "This employee no longer exists" };
  if (user.role !== Role.SUPER_ADMIN && !user.companyId) return { ok: false, error: "Your account is not assigned to a company" };
  const accessibleCompanyIds = await getAccessibleCompanyIds(user);
  if (accessibleCompanyIds && (!existing.companyId || !accessibleCompanyIds.includes(existing.companyId))) {
    return { ok: false, error: "You cannot edit an employee from another company" };
  }

  const firstName = textField(formData, "firstName");
  const lastName = textField(formData, "lastName");
  const employeeCode = textField(formData, "employeeCode");
  const email = textField(formData, "email");
  const companyId = textField(formData, "companyId");
  const departmentId = textField(formData, "departmentId");
  const designationId = textField(formData, "designationId");
  const employmentType = formData.get("employmentType") as EmploymentType;
  const status = formData.get("status") as EmployeeStatus;
  const joiningDate = parseDateInput(formData.get("joiningDate") as string | null);
  const dateOfBirthRaw = textField(formData, "dateOfBirth");
  const dateOfBirth = dateOfBirthRaw ? parseDateInput(dateOfBirthRaw) : null;
  const bloodGroup = textField(formData, "bloodGroup");
  const referenceName = textField(formData, "referenceName");
  const referencePhone = textField(formData, "referencePhone");
  const referenceRelation = textField(formData, "referenceRelation");

  if (!firstName || !lastName || !employeeCode) {
    return { ok: false, error: "First name, last name and employee code are required" };
  }
  if (existing.userId && !email) return { ok: false, error: "Work email is required" };
  if (email && !EMAIL_PATTERN.test(email)) return { ok: false, error: "Enter a valid work email" };
  if (!joiningDate) return { ok: false, error: "Enter a valid joining date" };
  if (joiningDate > parseDateInput(toDateInputValue(new Date()))!) return { ok: false, error: "Joining date cannot be in the future" };
  if (dateOfBirthRaw && !dateOfBirth) return { ok: false, error: "Enter a valid date of birth" };
  if (!EMPLOYMENT_TYPES.includes(employmentType)) return { ok: false, error: "Select an employment type" };
  // A released employee may keep their status; any change must be to an active status (reinstatement).
  if (!EDITABLE_STATUSES.includes(status) && status !== existing.status) {
    return { ok: false, error: "Terminated / Resigned is set by processing a release from the employee profile" };
  }
  if (bloodGroup && !(BLOOD_GROUPS as readonly string[]).includes(bloodGroup)) {
    return { ok: false, error: "Select a valid blood group" };
  }

  // The form omits "role" when the select is locked (no login, own record, or an account above the admin's grant);
  // a missing value keeps the current role.
  const currentRole = existing.user?.role ?? null;
  const requestedRole = formData.has("role") ? parseRole(formData.get("role")) : currentRole;
  if (formData.has("role") && !requestedRole) return { ok: false, error: "Select a valid system role" };
  const roleChanged = currentRole !== null && requestedRole !== null && requestedRole !== currentRole;
  if (roleChanged) {
    if (user.employeeId === employeeId) return { ok: false, error: "You cannot change your own role" };
    if (!canChangeRole(user.role, currentRole, requestedRole)) {
      return {
        ok: false,
        error: assignableRoles(user.role).includes(currentRole)
          ? `You cannot grant the ${roleLabels[requestedRole]} role`
          : `Only a Super Admin can change a ${roleLabels[currentRole]} account`,
      };
    }
  }

  const managerId = textField(formData, "managerId");
  if (user.role !== Role.SUPER_ADMIN) {
    if (!user.companyId) return { ok: false, error: "Your account is not assigned to a company" };
    if (companyId && companyId !== user.companyId) return { ok: false, error: "You cannot move an employee to another company" };
  }
  const effectiveCompanyId = user.role === Role.SUPER_ADMIN ? companyId : user.companyId;
  const managerError = await validateManager(managerId, employeeId, existing.managerId, effectiveCompanyId);
  if (managerError) return { ok: false, error: managerError };

  const images = await readEmployeeImages(formData);
  if (!images.ok) return images;

  if (effectiveCompanyId) {
    const company = await prisma.company.findUnique({ where: { id: effectiveCompanyId }, select: { id: true } });
    if (!company) return { ok: false, error: "Selected company no longer exists" };
  }
  if (departmentId) {
    const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { companyId: true } });
    if (!department) return { ok: false, error: "Selected department no longer exists" };
    if (department.companyId && department.companyId !== effectiveCompanyId) {
      return { ok: false, error: "Selected department belongs to a different company" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Only a newly picked or removed image changes its URL; an untouched picker keeps the stored one.
      const imageUrls = await saveEmployeeImages(tx, employeeId, images.images, existing);
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          firstName,
          lastName,
          employeeCode,
          biometricId: textField(formData, "biometricId"),
          companyId: effectiveCompanyId,
          departmentId,
          designationId,
          phone: textField(formData, "phone"),
          employmentType,
          status,
          joiningDate,
          gender: textField(formData, "gender"),
          dateOfBirth,
          nationalId: textField(formData, "nationalId"),
          address: textField(formData, "address"),
          bloodGroup,
          referenceName,
          referencePhone,
          referenceRelation,
          ...imageUrls,
          referenceDetails: textField(formData, "referenceDetails"),
          managerId,
        },
      });
      if (existing.userId && email) {
        // Reinstating a released employee (back to an active status) restores the login the release revoked.
        const reinstated = isSeparated(existing.status) && !isSeparated(status);
        await tx.user.update({
          where: { id: existing.userId },
          data: { email, ...(roleChanged ? { role: requestedRole } : {}), ...(reinstated ? { isActive: true } : {}) },
        });
      }
    }, { timeout: 15_000 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const fields = (err.meta?.target as string[] | undefined) ?? [];
      const label = fields.map((f) => duplicateFieldLabels[f] ?? f).join(", ") || "value";
      return { ok: false, error: `Another employee already uses this ${label}` };
    }
    throw err;
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/**
 * Confirms a release: stores the full & final settlement and sets the status to TERMINATED or RESIGNED.
 * Every amount is recomputed here, and the joining date is read from the employee record, never taken from the browser.
 */
export async function releaseEmployee(employeeId: string, input: ReleaseInput): Promise<EmployeeActionResult> {
  const user = await getWritableUser();
  if (!user) return guestWriteResult;
  if (!isHRAdmin(user.role)) {
    return { ok: false, error: "You do not have permission to release employees" };
  }
  if (user.employeeId === employeeId) return { ok: false, error: "You cannot process your own release" };

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { status: true, joiningDate: true, companyId: true } });
  if (!employee) return { ok: false, error: "This employee no longer exists" };
  if (user.role !== Role.SUPER_ADMIN && !user.companyId) return { ok: false, error: "Your account is not assigned to a company" };
  if (user.role !== Role.SUPER_ADMIN && employee.companyId !== user.companyId) return { ok: false, error: "You cannot release an employee from another company" };
  if (isSeparated(employee.status)) return { ok: false, error: "This employee has already been released" };

  if (input.separationType !== "TERMINATED" && input.separationType !== "RESIGNED") {
    return { ok: false, error: "Select a separation type" };
  }
  // Org-local calendar day of the stored joining date, the same value the calculator displayed.
  const joiningDateValue = toDateInputValue(employee.joiningDate);
  const joiningDate = parseDateInput(joiningDateValue)!;
  const releaseDate = parseDateInput(input.releaseDate);
  if (!releaseDate) return { ok: false, error: "Enter a valid release date" };
  if (releaseDate < joiningDate) return { ok: false, error: "Release date cannot be before the joining date" };

  const amounts = [input.basicSalary, input.unusedLeaveDays, input.unpaidSalaryDays, input.deductions];
  if (amounts.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0)) {
    return { ok: false, error: "Salary, days and deductions must be zero or positive numbers" };
  }
  if (input.basicSalary <= 0) return { ok: false, error: "Enter the basic salary" };

  const result = calculateSettlement({ ...input, joiningDate: joiningDateValue });

  // The status guard sits inside the transaction, so two concurrent confirmations cannot both store a settlement.
  const released = await prisma.$transaction(async (tx) => {
    const { count } = await tx.employee.updateMany({
      where: { id: employeeId, status: { notIn: [EmployeeStatus.TERMINATED, EmployeeStatus.RESIGNED] } },
      data: { status: input.separationType },
    });
    if (count === 0) return false;
    // Revoke login access with the release; reinstating the employee from Edit Profile restores it.
    await tx.user.updateMany({ where: { employee: { id: employeeId } }, data: { isActive: false } });
    await tx.finalSettlement.create({
      data: {
        employeeId,
        separationType: input.separationType,
        joiningDate,
        releaseDate,
        serviceDays: result.totalDays,
        payableYears: result.serviceBenefitRule.years,
        serviceBenefitDaysPerYear: result.serviceBenefitRule.daysPerYear,
        basicSalary: input.basicSalary,
        noticePayApplied: result.noticePayApplied,
        serviceBenefitApplied: input.includeServiceBenefit === true,
        unusedLeaveDays: input.unusedLeaveDays,
        unpaidSalaryDays: input.unpaidSalaryDays,
        noticePay: result.noticePay,
        serviceBenefit: result.serviceBenefit,
        leaveEncashment: result.leaveEncashment,
        unpaidSalary: result.unpaidSalary,
        deductions: result.deductions,
        netPayable: result.netPayable,
        processedById: user.id,
      },
    });
    return true;
  });
  if (!released) return { ok: false, error: "This employee has already been released" };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

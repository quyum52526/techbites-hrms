"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getWritableUser, guestWriteResult, isHRAdmin, type WritableUser } from "@/lib/auth";
import { GUEST_READ_ONLY_MESSAGE } from "@/lib/auth-shared";
import { getAccessibleCompanyIds } from "@/lib/company";
import { readCsvRecords } from "@/lib/csv";
import { readUploadedCsv, type ImportIssue, type ImportResult } from "@/lib/import-result";
import { parsePeriodParam } from "@/lib/payroll";
import { MAX_DEDUCTION_REMARKS, parseDeductionAmount } from "@/lib/payroll-deductions";

export type DeductionActionResult = { ok: true; message: string } | { ok: false; error: string };

const MAX_IMPORT_ROWS = 5_000;

const canAccessCompany = (accessibleIds: string[] | null, companyId: string | null): companyId is string =>
  !!companyId && (!accessibleIds || accessibleIds.includes(companyId));

/**
 * Sets one employee's advance deduction, demurrage claim and remarks for a payroll month (`useActionState` action).
 * Saving both amounts as 0 with no remarks removes the entry. Guests are refused first; only HR admins may save,
 * and only for employees of companies they can access.
 */
export async function saveEmployeeDeductions(_prev: DeductionActionResult | null, formData: FormData): Promise<DeductionActionResult> {
  const user = await getWritableUser();
  if (!user) return guestWriteResult;
  if (!isHRAdmin(user.role)) return { ok: false, error: "Only HR administrators can manage payroll deductions" };

  const employeeId = String(formData.get("employeeId") ?? "");
  const period = String(formData.get("period") ?? "");
  if (!employeeId) return { ok: false, error: "Choose an employee" };
  if (!parsePeriodParam(period)) return { ok: false, error: "Choose a valid payroll month" };

  const advance = parseDeductionAmount(formData.get("advanceDeduction") as string | null, "Advance deduction");
  if (!advance.ok) return advance;
  const demurrage = parseDeductionAmount(formData.get("demurrageClaim") as string | null, "Demurrage claim");
  if (!demurrage.ok) return demurrage;
  const remarks = String(formData.get("remarks") ?? "").trim() || null;
  if (remarks && remarks.length > MAX_DEDUCTION_REMARKS) return { ok: false, error: `Remarks can be at most ${MAX_DEDUCTION_REMARKS} characters` };

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true, firstName: true, lastName: true } });
  const accessibleIds = await getAccessibleCompanyIds(user);
  if (!employee || !canAccessCompany(accessibleIds, employee.companyId)) return { ok: false, error: "Employee not found in your companies" };

  const name = `${employee.firstName} ${employee.lastName}`;
  if (advance.value === 0 && demurrage.value === 0 && !remarks) {
    await prisma.payrollDeduction.deleteMany({ where: { employeeId, period } });
    revalidatePath("/dashboard/payroll");
    return { ok: true, message: `Cleared ${name}'s deductions for ${period}` };
  }

  const data = { companyId: employee.companyId, advanceDeduction: advance.value, demurrageClaim: demurrage.value, remarks, updatedById: user.id };
  await prisma.payrollDeduction.upsert({
    where: { employeeId_period: { employeeId, period } },
    create: { employeeId, period, ...data },
    update: data,
  });
  revalidatePath("/dashboard/payroll");
  return { ok: true, message: `Saved ${name}'s deductions for ${period}` };
}

type ValidRow = { line: number; employeeId: string; companyId: string; period: string; advanceDeduction: number; demurrageClaim: number; remarks: string | null };

/** Validates every row; nothing is returned as valid unless the whole file is. */
async function validateImport(user: WritableUser, records: { line: number; values: Record<string, string> }[]) {
  const issues: ImportIssue[] = [];
  const codes = [...new Set(records.map(({ values }) => values.employeecode).filter(Boolean))];
  const [employees, accessibleIds] = await Promise.all([
    // Codes are matched case-insensitively, as spreadsheets often change their case.
    prisma.employee.findMany({ where: { employeeCode: { in: codes, mode: "insensitive" } }, select: { id: true, employeeCode: true, companyId: true } }),
    getAccessibleCompanyIds(user),
  ]);
  // Codes are unique only case-sensitively: an exact match wins, and two employees differing only by case are ambiguous.
  const findEmployee = (code: string) => {
    const matches = employees.filter((employee) => employee.employeeCode.toLowerCase() === code.toLowerCase());
    return matches.find((employee) => employee.employeeCode === code) ?? (matches.length === 1 ? matches[0] : null);
  };

  const rows: ValidRow[] = [];
  const seen = new Map<string, number>();
  for (const { line, values } of records) {
    const code = values.employeecode ?? "";
    const period = values.period ?? "";
    const employee = code ? findEmployee(code) : null;
    const advance = parseDeductionAmount(values.advancededuction, "advanceDeduction");
    const demurrage = parseDeductionAmount(values.demurrageclaim, "demurrageClaim");
    const remarks = values.remarks?.trim() || null;
    const rowIssues: string[] = [];

    if (!code) rowIssues.push("employeeCode is empty");
    // Unknown and other-company codes get the same message, so an import cannot probe other companies' staff.
    else if (!employee || !canAccessCompany(accessibleIds, employee.companyId)) rowIssues.push(`No employee "${code}" in your companies`);
    if (!parsePeriodParam(period)) rowIssues.push(`period "${period}" must be YYYY-MM, e.g. 2026-09`);
    if (!advance.ok) rowIssues.push(advance.error);
    if (!demurrage.ok) rowIssues.push(demurrage.error);
    if (remarks && remarks.length > MAX_DEDUCTION_REMARKS) rowIssues.push(`remarks can be at most ${MAX_DEDUCTION_REMARKS} characters`);

    const key = `${code.toLowerCase()}|${period}`;
    const firstLine = seen.get(key);
    if (code && firstLine) rowIssues.push(`duplicate of line ${firstLine} (same employee and period)`);
    else seen.set(key, line);

    if (rowIssues.length > 0) {
      issues.push({ line, message: rowIssues.join("; ") });
      continue;
    }
    rows.push({
      line,
      employeeId: employee!.id,
      companyId: employee!.companyId!,
      period,
      advanceDeduction: advance.ok ? advance.value : 0,
      demurrageClaim: demurrage.ok ? demurrage.value : 0,
      remarks,
    });
  }
  return { rows, issues };
}

/**
 * Bulk deductions (columns: employeeCode, period, advanceDeduction, demurrageClaim, remarks). Each row sets that
 * employee's amounts for that month, replacing any earlier entry. Every row is validated first; if any row fails,
 * nothing is written and each problem is listed by line.
 */
export async function importPayrollDeductionsCsv(formData: FormData): Promise<ImportResult> {
  const fail = (message: string, issues: ImportIssue[] = []): ImportResult => ({ ok: false, message, stats: [], issues });

  const user = await getWritableUser();
  if (!user) return fail(GUEST_READ_ONLY_MESSAGE);
  if (!isHRAdmin(user.role)) return fail("Only HR administrators can import payroll deductions");

  const upload = await readUploadedCsv(formData);
  if (!upload.ok) return upload.result;
  const parsed = readCsvRecords(upload.text, ["employeeCode", "period", "advanceDeduction", "demurrageClaim"]);
  if (!parsed.ok) return fail(parsed.error);
  if (parsed.records.length > MAX_IMPORT_ROWS) return fail(`A single upload is limited to ${MAX_IMPORT_ROWS.toLocaleString()} rows; this file has ${parsed.records.length.toLocaleString()}`);

  const { rows, issues } = await validateImport(user, parsed.records);
  if (issues.length > 0) {
    return fail(`${issues.length} row(s) have problems, so nothing was imported. Fix them and upload the file again.`, issues);
  }

  await prisma.$transaction(
    rows.map((row) => {
      const data = { companyId: row.companyId, advanceDeduction: row.advanceDeduction, demurrageClaim: row.demurrageClaim, remarks: row.remarks, updatedById: user.id };
      return prisma.payrollDeduction.upsert({
        where: { employeeId_period: { employeeId: row.employeeId, period: row.period } },
        create: { employeeId: row.employeeId, period: row.period, ...data },
        update: data,
      });
    })
  );

  revalidatePath("/dashboard/payroll");
  return {
    ok: true,
    message: `Imported deductions for ${rows.length} row(s).`,
    stats: [
      { label: "Rows imported", value: rows.length },
      { label: "Employees", value: new Set(rows.map((row) => row.employeeId)).size },
      { label: "Payroll months", value: new Set(rows.map((row) => row.period)).size },
    ],
    issues: [],
  };
}

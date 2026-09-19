import { prisma } from "@/lib/prisma";
import { toDateInputValue } from "@/lib/employee-profile";
import { WORKFORCE_STATUSES } from "@/lib/company";
import type { EditableEmployee } from "@/components/dashboard/EditEmployeeModal";

/** Pre-fill data for EditEmployeeModal; null when the id matches no employee. */
export async function loadEditableEmployee(id: string): Promise<EditableEmployee | null> {
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, role: true } },
      manager: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
  });
  if (!employee) return null;

  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.user?.email ?? null,
    role: employee.user?.role ?? null,
    managerId: employee.managerId,
    // Kept as its own option so a manager who has since left still shows as the current value.
    currentManager: employee.manager ? toManagerOption(employee.manager) : null,
    employeeCode: employee.employeeCode,
    biometricId: employee.biometricId,
    companyId: employee.companyId,
    departmentId: employee.departmentId,
    designationId: employee.designationId,
    phone: employee.phone,
    employmentType: employee.employmentType,
    status: employee.status,
    joiningDate: toDateInputValue(employee.joiningDate),
    gender: employee.gender,
    dateOfBirth: employee.dateOfBirth ? toDateInputValue(employee.dateOfBirth) : null,
    nationalId: employee.nationalId,
    address: employee.address,
    bloodGroup: employee.bloodGroup,
    photoUrl: employee.photoUrl,
    nidScanUrl: employee.nidScanUrl,
    referenceDetails: employee.referenceDetails,
    referenceName: employee.referenceName,
    referencePhone: employee.referencePhone,
    referenceRelation: employee.referenceRelation,
  };
}

export type ManagerOption = { id: string; label: string };

const toManagerOption = (e: { id: string; firstName: string; lastName: string; employeeCode: string }): ManagerOption => ({
  id: e.id,
  label: `${e.firstName} ${e.lastName} (${e.employeeCode})`,
});

/** Company, department, designation and manager choices for the employee forms. */
export async function loadEmployeeFormOptions() {
  const [companies, departments, designations, managers] = await Promise.all([
    prisma.company.findMany({
      select: { id: true, name: true, code: true },
      orderBy: [{ type: "asc" }, { parentId: "asc" }, { name: "asc" }],
    }),
    prisma.department.findMany({ select: { id: true, name: true, companyId: true }, orderBy: { name: "asc" } }),
    prisma.designation.findMany({ select: { id: true, title: true } }),
    // Anyone still on the workforce can be a manager; released employees cannot.
    prisma.employee.findMany({
      where: { status: { in: WORKFORCE_STATUSES } },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);
  return { companies, departments, designations, managers: managers.map(toManagerOption) };
}

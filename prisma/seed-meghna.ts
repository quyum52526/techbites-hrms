import { PrismaClient, EmploymentType, EmployeeStatus } from "@prisma/client";

const prisma = new PrismaClient();

const EMPLOYEES = [
  { code: "MAL-0001", firstName: "Mahmudul", lastName: "Karim", department: "Production", designation: "Production Manager", model: "MONTHLY", basic: 65000 },
  { code: "MAL-0002", firstName: "Sharmin", lastName: "Akter", department: "Quality Control", designation: "Quality Executive", model: "MONTHLY", basic: 42000 },
  { code: "MAL-0003", firstName: "Rezaul", lastName: "Haque", department: "Merchandising", designation: "Merchandiser", model: "MONTHLY", basic: 48000 },
  { code: "MAL-0004", firstName: "Nusrat", lastName: "Jahan", department: "Human Resources", designation: "HR Executive", model: "MONTHLY", basic: 40000 },
  { code: "MAL-0005", firstName: "Tanvir", lastName: "Ahmed", department: "Production", designation: "Line Supervisor", model: "HOURLY", basic: 36000 },
  { code: "MAL-0006", firstName: "Farhana", lastName: "Islam", department: "Accounts", designation: "Accounts Officer", model: "MONTHLY", basic: 39000 },
  { code: "MAL-0007", firstName: "Jamal", lastName: "Uddin", department: "Administration", designation: "Admin Officer", model: "HOURLY", basic: 32000 },
  { code: "MAL-0008", firstName: "Robiul", lastName: "Hossain", department: "Compliance", designation: "Compliance Officer", model: "MONTHLY", basic: 38000 },
] as const;

async function main() {
  const company = await prisma.company.upsert({
    where: { code: "MAL" },
    update: { name: "Meghna Apparels Ltd.", logoUrl: "/companies/meghna-logo.svg" },
    create: { name: "Meghna Apparels Ltd.", code: "MAL", isParent: false, logoUrl: "/companies/meghna-logo.svg" },
  });

  for (const fixture of EMPLOYEES) {
    const department = await prisma.department.upsert({
      where: { name: fixture.department },
      update: { companyId: company.id },
      create: { name: fixture.department, companyId: company.id },
    });
    const designation = await prisma.designation.upsert({
      where: { title: fixture.designation },
      update: {},
      create: { title: fixture.designation },
    });
    const employee = await prisma.employee.upsert({
      where: { employeeCode: fixture.code },
      update: {
        firstName: fixture.firstName,
        lastName: fixture.lastName,
        companyId: company.id,
        departmentId: department.id,
        designationId: designation.id,
        employmentType: fixture.model === "HOURLY" ? EmploymentType.PART_TIME : EmploymentType.FULL_TIME,
        status: EmployeeStatus.ACTIVE,
      },
      create: {
        employeeCode: fixture.code,
        firstName: fixture.firstName,
        lastName: fixture.lastName,
        companyId: company.id,
        departmentId: department.id,
        designationId: designation.id,
        joiningDate: new Date("2026-01-01T00:00:00.000Z"),
        employmentType: fixture.model === "HOURLY" ? EmploymentType.PART_TIME : EmploymentType.FULL_TIME,
        status: EmployeeStatus.ACTIVE,
      },
    });
    await prisma.salaryStructure.upsert({
      where: { employeeId: employee.id },
      update: { basicSalary: fixture.basic, houseRent: fixture.basic * 0.4, medicalAllow: 2500, otherAllow: 0, taxDeduction: fixture.basic * 0.05, providentFund: fixture.basic * 0.05 },
      create: { employeeId: employee.id, basicSalary: fixture.basic, houseRent: fixture.basic * 0.4, medicalAllow: 2500, otherAllow: 0, taxDeduction: fixture.basic * 0.05, providentFund: fixture.basic * 0.05 },
    });
  }

  console.log(`Seeded ${EMPLOYEES.length} employees for ${company.name} (${company.code}).`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const SUPER_ADMIN_EMAIL = "quyum52526@gmail.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
const MAL_PASSWORD = process.env.MAL_INITIAL_PASSWORD ?? "Welcome123!";
const MAL_USERS = [
  ["MAL-0001", "mahmudul.karim@meghnaapparels.com", Role.HR_ADMIN],
  ["MAL-0002", "sharmin.akter@meghnaapparels.com", Role.HR_ADMIN],
  ["MAL-0003", "rezaul.haque@meghnaapparels.com", Role.TEAM_LEADER],
  ["MAL-0004", "nusrat.jahan@meghnaapparels.com", Role.EMPLOYEE],
  ["MAL-0005", "tanvir.ahmed@meghnaapparels.com", Role.EMPLOYEE],
  ["MAL-0006", "farhana.islam@meghnaapparels.com", Role.EMPLOYEE],
  ["MAL-0007", "jamal.uddin@meghnaapparels.com", Role.EMPLOYEE],
  ["MAL-0008", "robiul.hossain@meghnaapparels.com", Role.EMPLOYEE],
] as const;

async function main() {
  if (!SUPER_ADMIN_PASSWORD) throw new Error("SUPER_ADMIN_PASSWORD must be set when running this migration");
  const adminPasswordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
  const malPasswordHash = await bcrypt.hash(MAL_PASSWORD, 12);
  const mal = await prisma.company.findUniqueOrThrow({ where: { code: "MAL" }, select: { id: true } });
  const admin = await prisma.user.findFirst({ where: { email: { in: ["admin@techbites.com", SUPER_ADMIN_EMAIL] } }, select: { id: true } });
  if (!admin) throw new Error("Current super admin account was not found");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: admin.id }, data: { email: SUPER_ADMIN_EMAIL, passwordHash: adminPasswordHash, role: Role.SUPER_ADMIN, isActive: true } });

    await tx.user.deleteMany({ where: { email: { in: ["hr@techbites.com", "lead@techbites.com", "employee@techbites.com"] } } });

    const leader = await tx.employee.findUniqueOrThrow({ where: { employeeCode: "MAL-0003" }, select: { id: true, companyId: true } });
    if (leader.companyId !== mal.id) throw new Error("MAL-0003 is not assigned to MAL");

    for (const [employeeCode, email, role] of MAL_USERS) {
      const employee = await tx.employee.findUniqueOrThrow({ where: { employeeCode }, select: { id: true, companyId: true, userId: true, firstName: true, lastName: true } });
      if (employee.companyId !== mal.id) throw new Error(`${employeeCode} is not assigned to MAL`);

      const user = employee.userId
        ? await tx.user.update({ where: { id: employee.userId }, data: { email, passwordHash: malPasswordHash, role, isActive: true }, select: { id: true } })
        : await tx.user.upsert({ where: { email }, update: { passwordHash: malPasswordHash, role, isActive: true }, create: { email, passwordHash: malPasswordHash, role }, select: { id: true } });

      await tx.employee.update({ where: { id: employee.id }, data: { userId: user.id, managerId: employeeCode === "MAL-0003" ? null : leader.id } });
    }
  });

  console.log("Updated super admin, removed demo accounts, and configured MAL users.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());

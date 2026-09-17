import type { Role } from "@prisma/client";

export const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  HR_ADMIN: "HR Admin",
  TEAM_LEADER: "Team Leader",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};
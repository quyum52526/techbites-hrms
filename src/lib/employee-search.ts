import type { Prisma } from "@prisma/client";

/** Matches the ⌘K palette's employee search: name, code or login email. */
export function employeeSearchWhere(query: string): Prisma.EmployeeWhereInput {
  const words = query.trim().split(/\s+/).filter(Boolean);
  return {
    AND: words.map((word): Prisma.EmployeeWhereInput => ({
      OR: [
        { firstName: { contains: word, mode: "insensitive" } },
        { lastName: { contains: word, mode: "insensitive" } },
        { employeeCode: { contains: word, mode: "insensitive" } },
        { user: { email: { contains: word, mode: "insensitive" } } },
      ],
    })),
  };
}

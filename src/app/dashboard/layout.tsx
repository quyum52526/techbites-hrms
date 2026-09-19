import Sidebar from "@/components/dashboard/Sidebar";
import TopNav from "@/components/dashboard/TopNav";
import { MobileNavProvider } from "@/components/dashboard/MobileNav";
import { getActiveUser } from "@/lib/auth";
import { canSwitchCompanyForUser, getAccessibleCompanyIds, getActiveCompanyId } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { ROLE_OPTIONS } from "@/lib/auth-shared";

/** Development-only list for the user menu's account switcher: active logins, highest access first. */
async function loadSwitchableAccounts() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, email: true, role: true, employee: { select: { firstName: true, lastName: true } } },
    orderBy: { email: "asc" },
    take: 50,
  });
  return users
    .map(({ employee, ...user }) => ({ ...user, name: employee ? `${employee.firstName} ${employee.lastName}` : null }))
    .sort((a, b) => ROLE_OPTIONS.indexOf(b.role) - ROLE_OPTIONS.indexOf(a.role));
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getActiveUser();
  const canSwitchCompany = await canSwitchCompanyForUser(user);
  const switchableAccounts = process.env.NODE_ENV === "production" ? null : await loadSwitchableAccounts();
  const accessibleCompanyIds = canSwitchCompany ? await getAccessibleCompanyIds(user) : null;
  const allowAllCompanies = canSwitchCompany && accessibleCompanyIds === null;
  const [companies, activeCompanyId] = canSwitchCompany
    ? await Promise.all([
        prisma.company.findMany({
          where: accessibleCompanyIds ? { id: { in: accessibleCompanyIds } } : undefined,
          select: { id: true, name: true, code: true, logoUrl: true },
          orderBy: [{ type: "asc" }, { parentId: "asc" }, { name: "asc" }],
        }),
        getActiveCompanyId(),
      ])
    : [[], null];

  return (
    <MobileNavProvider>
      <div className="flex h-dvh overflow-hidden bg-surface-muted">
        <Sidebar user={user} />
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <TopNav
            user={{ id: user.id, email: user.email, role: user.role, name: user.name }}
            switchableAccounts={switchableAccounts}
            companies={companies}
            activeCompanyId={activeCompanyId}
            canSwitchCompany={canSwitchCompany}
            allowAllCompanies={allowAllCompanies}
          />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
export const dynamic = "force-dynamic";
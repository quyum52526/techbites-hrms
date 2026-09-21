import Sidebar from "@/components/dashboard/Sidebar";
import TopNav from "@/components/dashboard/TopNav";
import Link from "next/link";
import { Eye, LogIn } from "lucide-react";
import { MobileNavProvider } from "@/components/dashboard/MobileNav";
import { ReadOnlyProvider } from "@/components/ui/ReadOnly";
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
  // Never for guests, even in development: switching out of a guest session would mix its state into a real account.
  const switchableAccounts = process.env.NODE_ENV === "production" || user.role === "GUEST" ? null : await loadSwitchableAccounts();
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
  const guest = user.role === "GUEST";
  const guestCompany = guest && user.companyId ? await prisma.company.findUnique({ where: { id: user.companyId }, select: { name: true } }) : null;

  return (
    <ReadOnlyProvider readOnly={guest}>
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
            {guest && (
              <div role="status" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 sm:px-6 py-2 text-xs text-amber-900">
                <p className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  <span>
                    <strong className="font-semibold">Guest Mode · read-only.</strong> You are browsing {guestCompany?.name ?? "a demo company"}; changes are
                    disabled.
                  </span>
                </p>
                <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-amber-900 underline-offset-2 hover:underline">
                  <LogIn className="w-3.5 h-3.5" aria-hidden /> Sign in with your account
                </Link>
              </div>
            )}
            <main className="flex-1 p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </MobileNavProvider>
    </ReadOnlyProvider>
  );
}
export const dynamic = "force-dynamic";
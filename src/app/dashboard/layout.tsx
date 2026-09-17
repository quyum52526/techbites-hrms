import Sidebar from "@/components/dashboard/Sidebar";
import TopNav from "@/components/dashboard/TopNav";
import { getActiveUser } from "@/lib/auth";
import { getActiveCompanyId } from "@/lib/company";
import { prisma } from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getActiveUser();
  const canSwitchCompany = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";
  const [companies, activeCompanyId] = canSwitchCompany
    ? await Promise.all([
        prisma.company.findMany({
          select: { id: true, name: true, code: true },
          orderBy: [{ isParent: "desc" }, { name: "asc" }],
        }),
        getActiveCompanyId(),
      ])
    : [[], null];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <TopNav role={user.role} companies={companies} activeCompanyId={activeCompanyId} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
export const dynamic = "force-dynamic";
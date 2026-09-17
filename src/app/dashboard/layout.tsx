import Sidebar from "@/components/dashboard/Sidebar";
import TopNav from "@/components/dashboard/TopNav";
import { getActiveUser } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getActiveUser();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <TopNav role={user.role} />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
export const dynamic = "force-dynamic";
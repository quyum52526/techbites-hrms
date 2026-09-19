import { Bell } from "lucide-react";
import UserMenu, { type MenuAccount } from "@/components/dashboard/UserMenu";
import CompanySwitcher from "@/components/dashboard/CompanySwitcher";
import CommandPalette from "@/components/dashboard/CommandPalette";
import { MobileNavTrigger } from "@/components/dashboard/MobileNav";

interface Props {
  user: MenuAccount;
  /** Development only; null hides account switching. */
  switchableAccounts: MenuAccount[] | null;
  companies: { id: string; name: string; code: string; logoUrl: string | null }[];
  activeCompanyId: string | null;
}

export default function TopNav({ user, switchableAccounts, companies, activeCompanyId }: Props) {
  const { role } = user;
  const canSwitchCompany = role === "SUPER_ADMIN" || role === "HR_ADMIN";

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-4 shrink-0">
      <div className="flex flex-1 min-w-0 items-center gap-2">
        <MobileNavTrigger />
        <CommandPalette role={role} />
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {canSwitchCompany && <CompanySwitcher companies={companies} activeCompanyId={activeCompanyId} />}
        {/* No notification feed exists yet, so the bell shows no unread dot rather than a permanent false one. */}
        <button
          type="button"
          aria-label="Notifications"
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors duration-200"
        >
          <Bell className="w-4 h-4" aria-hidden />
        </button>
        <UserMenu user={user} switchableAccounts={switchableAccounts} />
      </div>
    </header>
  );
}

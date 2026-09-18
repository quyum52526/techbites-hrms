import { Bell } from "lucide-react";
import type { Role } from "@prisma/client";
import { roleLabels } from "@/lib/auth-shared";
import CompanySwitcher from "@/components/dashboard/CompanySwitcher";
import CommandPalette from "@/components/dashboard/CommandPalette";
import { MobileNavTrigger } from "@/components/dashboard/MobileNav";

interface Props {
  role: Role;
  companies: { id: string; name: string; code: string; logoUrl: string | null }[];
  activeCompanyId: string | null;
}

export default function TopNav({ role, companies, activeCompanyId }: Props) {
  const canSwitchCompany = role === "SUPER_ADMIN" || role === "HR_ADMIN";

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3 sm:gap-4 shrink-0">
      <div className="flex flex-1 min-w-0 items-center gap-2">
        <MobileNavTrigger />
        <CommandPalette role={role} />
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {canSwitchCompany && <CompanySwitcher companies={companies} activeCompanyId={activeCompanyId} />}
        <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-accent-50 text-accent-700 text-[11px] font-semibold tracking-wide">
          {roleLabels[role]}
        </span>
        {/* No notification feed exists yet, so the bell shows no unread dot rather than a permanent false one. */}
        <button
          type="button"
          aria-label="Notifications"
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors duration-200"
        >
          <Bell className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Users,
  Clock,
  CalendarDays,
  CreditCard,
  Building2,
  BarChart3,
  Settings,
  LayoutDashboard,
  Gauge,
} from "lucide-react";
import { clsx } from "clsx";
import type { Role } from "@prisma/client";
import { PERFORMANCE_ROLES, roleLabels } from "@/lib/auth-shared";
import { MobileNavDrawer } from "@/components/dashboard/MobileNav";

export const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "TEAM_LEADER", "EMPLOYEE"] },
  { label: "Employees", href: "/dashboard/employees", icon: Users, roles: ["SUPER_ADMIN", "HR_ADMIN"] },
  { label: "Attendance", href: "/dashboard/attendance", icon: Clock, roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "TEAM_LEADER", "EMPLOYEE"] },
  { label: "Leave Requests", href: "/dashboard/leaves", icon: CalendarDays, roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "TEAM_LEADER", "EMPLOYEE"] },
  { label: "Payroll", href: "/dashboard/payroll", icon: CreditCard, roles: ["SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE"] },
  { label: "Departments", href: "/dashboard/departments", icon: Building2, roles: ["SUPER_ADMIN", "HR_ADMIN"] },
  { label: "Reports & BI", href: "/dashboard/reports", icon: BarChart3, roles: ["SUPER_ADMIN", "HR_ADMIN", "MANAGER"] },
  { label: "Performance", href: "/dashboard/performance", icon: Gauge, roles: PERFORMANCE_ROLES },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["SUPER_ADMIN", "HR_ADMIN"] },
];

function isActiveRoute(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarUser = { email: string; role: Role };

/** Brand, navigation and profile; shared by the desktop sidebar and the mobile drawer. */
function SidebarPanel({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full min-h-full flex-col bg-linear-to-b from-sidebar to-sidebar-deep text-slate-100">
      {/* Brand Header: the logo's violet wordmark is unreadable on navy, so it sits on a white plate. */}
      <div className="h-16 flex items-center px-4 border-b border-white/5 shrink-0">
        <Link
          href="/dashboard"
          aria-label="TechBites HRMS home"
          className="relative block h-11 w-[157px] overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-white/10"
        >
          {/* The PNG is a 2000px square with wide padding; offset it so the ~1395x390 artwork fills the plate. */}
          <Image
            src="/tech-bites-hrms-logo.png"
            alt=""
            width={2000}
            height={2000}
            priority
            className="absolute max-w-none w-[190px] h-[190px] left-[-9px] top-[-70px]"
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav aria-label="Primary" className="flex-1 px-3 py-4 space-y-1">
        {navItems.filter((item) => item.roles.includes(user.role)).map((item) => {
          const Icon = item.icon;
          const isActive = isActiveRoute(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              // Every item shares these literal class strings (no per-item or interpolated classes), so hover and
              // focus look identical on all links. brand-400 focus outline: the global brand-600 one is too dark on navy.
              className={clsx(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-colors duration-150 focus-visible:outline-brand-400",
                isActive
                  ? "bg-linear-to-r from-brand-500/20 to-accent-500/20 text-white ring-1 ring-brand-400/30 shadow-[0_0_18px_-4px_rgb(0_174_239/0.55)]"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              )}
            >
              {isActive && (
                <span aria-hidden className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-linear-to-b from-brand-400 to-accent-400" />
              )}
              <Icon className={clsx("w-4 h-4", isActive && "text-brand-400")} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* System Status / Bottom Profile */}
      <div className="p-4 border-t border-white/5 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-linear-to-br from-brand-600 to-accent-700 flex items-center justify-center text-xs font-bold text-white">
          {initials}
        </div>
        <div className="text-xs overflow-hidden">
          <p className="font-medium truncate">{user.email}</p>
          <p className="text-[11px] text-brand-400">{roleLabels[user.role]}</p>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ user }: { user: SidebarUser }) {
  return (
    <>
      {/* Desktop: fixed column from `lg` up. */}
      <aside className="hidden lg:flex w-64 shrink-0 overflow-y-auto border-r border-white/5 bg-sidebar-deep">
        <div className="w-full min-h-full">
          <SidebarPanel user={user} />
        </div>
      </aside>
      {/* Below `lg`: the same panel in a slide-out drawer opened from the TopNav hamburger. */}
      <MobileNavDrawer>
        <SidebarPanel user={user} />
      </MobileNavDrawer>
    </>
  );
}

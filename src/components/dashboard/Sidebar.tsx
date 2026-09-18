"use client";

import Link from "next/link";
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
import { roleLabels } from "@/lib/auth-shared";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "HR_ADMIN", "TEAM_LEADER", "EMPLOYEE"] },
  { label: "Employees", href: "/dashboard/employees", icon: Users, roles: ["SUPER_ADMIN", "HR_ADMIN"] },
  { label: "Attendance", href: "/dashboard/attendance", icon: Clock, roles: ["SUPER_ADMIN", "HR_ADMIN", "TEAM_LEADER", "EMPLOYEE"] },
  { label: "Leave Requests", href: "/dashboard/leaves", icon: CalendarDays, roles: ["SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE"] },
  { label: "Payroll", href: "/dashboard/payroll", icon: CreditCard, roles: ["SUPER_ADMIN", "HR_ADMIN", "EMPLOYEE"] },
  { label: "Departments", href: "/dashboard/departments", icon: Building2, roles: ["SUPER_ADMIN", "HR_ADMIN"] },
  { label: "Reports & BI", href: "/dashboard/reports", icon: BarChart3, roles: ["SUPER_ADMIN", "HR_ADMIN"] },
  { label: "Performance", href: "/dashboard/performance", icon: Gauge, roles: ["SUPER_ADMIN", "HR_ADMIN", "TEAM_LEADER"] },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["SUPER_ADMIN"] },
];

export default function Sidebar({ user }: { user: { email: string; role: Role } }) {
  const pathname = usePathname();
  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800">
        <img
          src="/tech-bites-hrms-logo.png"
          alt="TechBites HRMS"
          className="h-9 w-auto max-w-[180px] object-contain"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.filter((item) => item.roles.includes(user.role)).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors",
                isActive 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* System Status / Bottom Profile */}
      <div className="p-4 border-t border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
          {initials}
        </div>
        <div className="text-xs overflow-hidden">
          <p className="font-medium truncate">{user.email}</p>
          <p className="text-[10px] text-emerald-400">{roleLabels[user.role]}</p>
        </div>
      </div>
    </aside>
  );
}
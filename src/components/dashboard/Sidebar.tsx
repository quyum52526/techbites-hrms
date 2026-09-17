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
  LayoutDashboard 
} from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Employees", href: "/dashboard/employees", icon: Users },
  { label: "Attendance", href: "/dashboard/attendance", icon: Clock },
  { label: "Leave Requests", href: "/dashboard/leaves", icon: CalendarDays },
  { label: "Payroll", href: "/dashboard/payroll", icon: CreditCard },
  { label: "Departments", href: "/dashboard/departments", icon: Building2 },
  { label: "Reports & BI", href: "/dashboard/reports", icon: BarChart3 },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
          TB
        </div>
        <div>
          <h1 className="font-semibold text-sm tracking-wide">TechBites</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">HRMS Suite</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
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
          SA
        </div>
        <div className="text-xs overflow-hidden">
          <p className="font-medium truncate">admin@techbites.com</p>
          <p className="text-[10px] text-emerald-400">● Super Admin</p>
        </div>
      </div>
    </aside>
  );
}
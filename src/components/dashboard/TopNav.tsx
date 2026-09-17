import { Bell, Search } from "lucide-react";
import type { Role } from "@prisma/client";
import { roleLabels } from "@/lib/auth-shared";

export default function TopNav({ role }: { role: Role }) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      <div className="relative w-80">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search employees, departments, records..."
          className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center gap-4">
        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold tracking-wide">
          {roleLabels[role]}
        </span>
        <button className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 relative">
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5 ring-2 ring-white"></span>
        </button>
      </div>
    </header>
  );
}
"use client";

import { useTransition } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { setActiveCompany } from "@/app/actions/company";
import CompanyLogo from "@/components/dashboard/CompanyLogo";

interface Props {
  companies: { id: string; name: string; code: string; logoUrl: string | null }[];
  activeCompanyId: string | null;
}

export default function CompanySwitcher({ companies, activeCompanyId }: Props) {
  const [isPending, startTransition] = useTransition();
  const activeCompany = companies.find((company) => company.id === activeCompanyId);
  const activeLogoUrl = activeCompany?.logoUrl ?? null;

  return (
    <div className="relative flex items-center">
      {/* Native <select> options can't render images, so the active company's logo sits beside the label. */}
      {activeCompany && activeLogoUrl ? (
        <span className="absolute left-1.5 pointer-events-none">
          <CompanyLogo key={activeCompany.id} name={activeCompany.name} logoUrl={activeLogoUrl} className="w-5 h-5 rounded" />
        </span>
      ) : (
        <Building2 className="w-3.5 h-3.5 absolute left-2.5 text-slate-500 pointer-events-none" />
      )}
      <select
        aria-label="Filter by company"
        value={activeCompanyId ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value || null;
          startTransition(() => setActiveCompany(value));
        }}
        className="appearance-none pl-8 pr-7 py-1.5 max-w-52 truncate text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-600 disabled:opacity-60"
      >
        <option value="">All Companies</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name} ({company.code})
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 absolute right-2 text-slate-500 pointer-events-none" />
    </div>
  );
}

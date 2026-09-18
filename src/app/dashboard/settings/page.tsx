import { prisma } from "@/lib/prisma";
import { getCompanies } from "@/app/actions/company";
import { getActiveUser } from "@/lib/auth";
import CompanyManager from "@/components/dashboard/CompanyManager";
import ShiftPolicyForm from "@/components/dashboard/ShiftPolicyForm";
import { Settings, ShieldAlert, Clock, Building2 } from "lucide-react";

export default async function SettingsPage() {
  const user = await getActiveUser();
  // Same roles the shift and company server actions accept.
  const canManage = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";

  const [defaultShift, leaveTypes, adminUser, companies] = await Promise.all([
    prisma.shift.findFirst(),
    prisma.leaveType.findMany(),
    prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } }),
    canManage ? getCompanies() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-bold text-slate-800">System & HR Settings</h2>
        <p className="text-xs text-slate-500">Configure global working shifts, organization profile, and leave policies</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Working Hours & Shift Rules */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-semibold text-sm text-slate-800">
            <Clock className="w-4 h-4 text-brand-600" />
            <span>Attendance & Shift Policy</span>
          </div>

          {defaultShift && canManage ? (
            <ShiftPolicyForm
              shift={{
                id: defaultShift.id,
                name: defaultShift.name,
                startTime: defaultShift.startTime,
                endTime: defaultShift.endTime,
                graceMinutes: defaultShift.graceMinutes,
              }}
            />
          ) : defaultShift ? (
            <dl className="divide-y divide-slate-100 text-xs">
              {[
                { term: "Shift name", value: defaultShift.name },
                { term: "Punch-in window start", value: defaultShift.startTime },
                { term: "Punch-out window end", value: defaultShift.endTime },
                { term: "Late grace window", value: `${defaultShift.graceMinutes} minutes` },
              ].map((item) => (
                <div key={item.term} className="py-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <dt className="text-slate-600 font-medium">{item.term}</dt>
                  <dd className="text-slate-900 font-medium tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-slate-600">No shift record found to configure.</p>
          )}
        </div>

        {/* Company Organization Info */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-semibold text-sm text-slate-800">
            <Building2 className="w-4 h-4 text-emerald-700" />
            <span>Organization Profile</span>
          </div>

          {/* Read-only facts, so a description list rather than disabled inputs that look editable. */}
          <dl className="divide-y divide-slate-100 text-xs">
            {[
              { term: "Company legal entity", value: "TechBites HRMS Global Ltd." },
              { term: "Primary master administrator", value: adminUser?.email ?? "admin@techbites.com" },
              { term: "Timezone & locale", value: "Asia/Dhaka (GMT+6)" },
            ].map((item) => (
              <div key={item.term} className="py-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <dt className="text-slate-600 font-medium">{item.term}</dt>
                <dd className="text-slate-900 font-medium break-all">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Sister Concerns & Companies */}
        {canManage && (
          <div className="lg:col-span-2">
            <CompanyManager companies={companies} />
          </div>
        )}

        {/* Leave Quota Matrix */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 font-semibold text-sm text-slate-800">
            <Settings className="w-4 h-4 text-slate-600" />
            <span>Configured Annual Leave Quotas</span>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {leaveTypes.map((type) => (
              <div key={type.id} className="py-2.5 flex justify-between items-center">
                <span className="font-medium text-slate-700">{type.name}</span>
                <span className="px-2.5 py-0.5 rounded-full font-bold bg-brand-50 text-brand-700">
                  {type.daysAllowed} Days / Year
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Security & Access Audit */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 font-semibold text-sm text-slate-800">
            <ShieldAlert className="w-4 h-4 text-amber-700" />
            <span>Security & Data Isolation</span>
          </div>
          <div className="text-xs text-slate-600 space-y-2">
            <p>• Multi-factor password encryption: <strong>Bcryptjs (10 Salt Rounds)</strong></p>
            <p>• Database SSL Connection: <strong>Enforced via Neon TLS Pooler</strong></p>
            <p>• Session Role Isolation: <strong>Super Admin Role Active</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
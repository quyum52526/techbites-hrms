import { prisma } from "@/lib/prisma";
import { updateShiftConfig } from "@/app/actions/settings";
import { Settings, ShieldAlert, Clock, Building2, Save } from "lucide-react";

export default async function SettingsPage() {
  const [defaultShift, leaveTypes, adminUser] = await Promise.all([
    prisma.shift.findFirst(),
    prisma.leaveType.findMany(),
    prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } }),
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
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Attendance & Shift Policy</span>
          </div>

          {defaultShift ? (
            <form action={updateShiftConfig} className="space-y-3 text-xs">
              <input type="hidden" name="shiftId" value={defaultShift.id} />

              <div>
                <label className="block text-slate-600 font-medium mb-1">Shift Name</label>
                <input
                  type="text"
                  disabled
                  value={defaultShift.name}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Punch-in Window Start</label>
                  <input
                    type="time"
                    name="startTime"
                    defaultValue={defaultShift.startTime}
                    required
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Punch-out Window End</label>
                  <input
                    type="time"
                    name="endTime"
                    defaultValue={defaultShift.endTime}
                    required
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Late Grace Window (Minutes)</label>
                <input
                  type="number"
                  name="graceMinutes"
                  defaultValue={defaultShift.graceMinutes}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Punches after {defaultShift.graceMinutes} minutes past start time trigger "LATE" status.
                </span>
              </div>

              <button
                type="submit"
                className="flex items-center justify-center gap-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
              >
                <Save className="w-3.5 h-3.5" /> Save Shift Policies
              </button>
            </form>
          ) : (
            <p className="text-xs text-slate-400">No shift record found to configure.</p>
          )}
        </div>

        {/* Company Organization Info */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-semibold text-sm text-slate-800">
            <Building2 className="w-4 h-4 text-emerald-600" />
            <span>Organization Profile</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Company Legal Entity</label>
              <input
                type="text"
                disabled
                value="TechBites HRMS Global Ltd."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 cursor-not-allowed font-medium"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Primary Master Administrator</label>
              <input
                type="text"
                disabled
                value={adminUser?.email ?? "admin@techbites.com"}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-700 cursor-not-allowed font-medium"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Timezone & Locale</label>
              <input
                type="text"
                disabled
                value="Asia/Dhaka (GMT+6)"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

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
                <span className="px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700">
                  {type.daysAllowed} Days / Year
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Security & Access Audit */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 font-semibold text-sm text-slate-800">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
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
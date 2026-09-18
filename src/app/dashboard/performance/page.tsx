import { Gauge, Users, CalendarDays } from "lucide-react";
import { getActiveUser } from "@/lib/auth";
import { getAppraisalCycles, getReviewsForCycle } from "@/app/actions/performance";
import PerformanceReviewForm from "@/components/dashboard/PerformanceReviewForm";

export default async function PerformancePage() {
  const user = await getActiveUser();
  const cycles = await getAppraisalCycles();
  const cycle = cycles[0];
  const rows = cycle ? await getReviewsForCycle(cycle.id, user.employeeId ?? undefined) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold text-slate-800">Performance Reviews</h2><p className="text-xs text-slate-500">Track attendance and structured team evaluations</p></div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs"><CalendarDays className="w-4 h-4 text-brand-600" /><select aria-label="Review cycle" defaultValue={cycle?.id} className="bg-transparent outline-none">{cycles.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.period}</option>)}</select></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><Gauge className="w-5 h-5 text-brand-600 mb-3" /><p className="text-xs text-slate-500">Active Cycle</p><p className="font-bold text-slate-900 mt-1">{cycle?.title ?? "No cycle yet"}</p></div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><Users className="w-5 h-5 text-emerald-700 mb-3" /><p className="text-xs text-slate-500">Employees in Scope</p><p className="text-2xl font-bold text-slate-900 mt-1">{rows.length}</p></div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><CalendarDays className="w-5 h-5 text-amber-700 mb-3" /><p className="text-xs text-slate-500">Review Window</p><p className="font-bold text-slate-900 mt-1">{cycle ? `${cycle.startDate.toLocaleDateString()} - ${cycle.endDate.toLocaleDateString()}` : "Create a cycle"}</p></div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-100"><h3 className="text-sm font-bold text-slate-800">Performance Summary</h3></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500 border-b border-slate-200"><tr><th className="py-3 px-4">Employee</th><th className="py-3 px-4">Subordinate Team</th><th className="py-3 px-4">Attendance Rate</th><th className="py-3 px-4">Team Leader Rating</th><th className="py-3 px-4">Computed Final Score</th><th className="py-3 px-4">Review</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(({ employee, review }) => <tr key={employee.id}><td className="py-3 px-4 font-semibold text-slate-900">{employee.firstName} {employee.lastName}</td><td className="py-3 px-4 text-slate-500">{employee.department?.name ?? "Unassigned"}</td><td className="py-3 px-4">{review ? `${review.attendanceScore.toFixed(1)}%` : "Pending"}</td><td className="py-3 px-4">{review ? `${((review.productivity + review.qualityOfWork + review.collaboration) / 3).toFixed(1)} / 5` : "Pending"}</td><td className="py-3 px-4 font-bold text-brand-700">{review ? `${review.finalScore.toFixed(1)} / 100` : "-"}</td><td className="py-3 px-4">{review ? <PerformanceReviewForm reviewId={review.id} values={{ productivity: review.productivity, qualityOfWork: review.qualityOfWork, collaboration: review.collaboration }} /> : <span className="text-slate-500">No review record</span>}</td></tr>)}</tbody></table></div></div>
    </div>
  );
}
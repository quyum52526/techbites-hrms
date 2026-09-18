import { Gauge, Users, CalendarDays } from "lucide-react";
import { clsx } from "clsx";
import { getActiveUser } from "@/lib/auth";
import { getAppraisalCycles, getReviewsForCycle } from "@/app/actions/performance";
import PerformanceReviewForm from "@/components/dashboard/PerformanceReviewForm";
import CycleSelect from "@/components/dashboard/CycleSelect";
import StatCard from "@/components/dashboard/StatCard";
import { cardClass } from "@/components/ui/styles";

const formatDate = (date: Date) => date.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  const [user, cycles, { cycle: requestedCycle }] = await Promise.all([getActiveUser(), getAppraisalCycles(), searchParams]);
  // Only ids from the list are accepted, so a stale or hand-edited ?cycle= falls back to the current cycle.
  const cycle = cycles.find((c) => c.id === requestedCycle) ?? cycles[0];
  const rows = cycle ? await getReviewsForCycle(cycle.id, user.employeeId ?? undefined) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Performance Reviews</h2>
          <p className="text-xs text-slate-600">Track attendance and structured team evaluations</p>
        </div>
        <CycleSelect
          cycles={cycles.map((c) => ({ id: c.id, label: `${c.title} · ${c.period}` }))}
          selectedId={cycle?.id}
        />
      </div>

      {/* Summary tiles are informational (no list behind them), so they render static: no hover lift or pointer. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Active Cycle" value={<span className="text-base">{cycle?.title ?? "No cycle yet"}</span>} icon={Gauge} tone="brand" />
        <StatCard label="Employees in Scope" value={rows.length} icon={Users} tone="success" />
        <StatCard
          label="Review Window"
          value={<span className="text-base">{cycle ? `${formatDate(cycle.startDate)} – ${formatDate(cycle.endDate)}` : "Create a cycle"}</span>}
          icon={CalendarDays}
          tone="warning"
        />
      </div>

      <div className={clsx(cardClass, "overflow-hidden")}>
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Performance Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Employee</th>
                <th className="py-3 px-4 font-semibold">Subordinate Team</th>
                <th className="py-3 px-4 font-semibold">Attendance Rate</th>
                <th className="py-3 px-4 font-semibold">Team Leader Rating</th>
                <th className="py-3 px-4 font-semibold">Computed Final Score</th>
                <th className="py-3 px-4 font-semibold">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-600">
                    {cycle ? "No employees in scope for this cycle." : "No appraisal cycle yet."}
                  </td>
                </tr>
              ) : (
                rows.map(({ employee, review }) => {
                  const name = `${employee.firstName} ${employee.lastName}`;
                  return (
                    <tr key={employee.id} className="align-top hover:bg-slate-50 transition-colors duration-150">
                      <td className="py-3 px-4 font-semibold text-slate-900">{name}</td>
                      <td className="py-3 px-4 text-slate-600">{employee.department?.name ?? "Unassigned"}</td>
                      <td className="py-3 px-4 tabular-nums text-slate-900">{review ? `${review.attendanceScore.toFixed(1)}%` : "Pending"}</td>
                      <td className="py-3 px-4 tabular-nums text-slate-900">
                        {review ? `${((review.productivity + review.qualityOfWork + review.collaboration) / 3).toFixed(1)} / 5` : "Pending"}
                      </td>
                      <td className="py-3 px-4 font-bold tabular-nums text-brand-700">{review ? `${review.finalScore.toFixed(1)} / 100` : "–"}</td>
                      <td className="py-3 px-4">
                        {review ? (
                          <PerformanceReviewForm
                            reviewId={review.id}
                            employeeName={name}
                            values={{ productivity: review.productivity, qualityOfWork: review.qualityOfWork, collaboration: review.collaboration }}
                          />
                        ) : (
                          <span className="text-slate-600">No review record</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

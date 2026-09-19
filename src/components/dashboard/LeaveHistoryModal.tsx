"use client";

import { useState, useTransition } from "react";
import { History, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { getEmployeeLeaveHistory } from "@/app/actions/leaves";
import Modal from "@/components/ui/Modal";
import { leaveStatusBadgeClass, leaveStatusLabels, type LeaveHistoryEntry } from "@/lib/leave-shared";

// Leave dates are calendar dates stored at UTC midnight, so they are formatted in UTC to avoid a day shift.
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** "View History" button: loads the employee's full leave history when opened. */
export default function LeaveHistoryModal({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<LeaveHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();

  const openHistory = () => {
    setOpen(true);
    setError(null);
    startLoading(async () => {
      try {
        setHistory(await getEmployeeLeaveHistory(employeeId));
      } catch {
        setError("Could not load the leave history. Please try again.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openHistory}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
      >
        <History className="w-3.5 h-3.5" aria-hidden /> View History
      </button>
      <Modal open={open} onClose={() => setOpen(false)} size="2xl" title={`Leave history · ${employeeName}`} description="All leave requests, newest first.">
        <div className="p-6 text-xs">
          {isLoading ? (
            <p role="status" className="flex items-center gap-2 text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Loading history…
            </p>
          ) : error ? (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 font-medium text-rose-700">{error}</p>
          ) : !history || history.length === 0 ? (
            <p className="text-slate-600">No leave requests on record.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.map((entry) => (
                <li key={entry.id} className="py-3 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {entry.leaveType}
                      <span className="font-normal text-slate-600">
                        {" · "}{formatDate(entry.startDate)} – {formatDate(entry.endDate)} ({entry.days} {entry.days === 1 ? "day" : "days"})
                      </span>
                    </p>
                    <span className={clsx("px-2 py-0.5 rounded-full text-[11px] font-semibold", leaveStatusBadgeClass(entry.status))}>
                      {leaveStatusLabels[entry.status]}
                    </span>
                  </div>
                  <p className="text-slate-700 whitespace-pre-line">{entry.reason}</p>
                  <p className="text-[11px] text-slate-500">
                    Applied {formatDate(entry.appliedOn)}
                    {entry.lastActionBy && <> · last action by {entry.lastActionBy}</>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}

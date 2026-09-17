"use client";

import { useState, useEffect } from "react";
import { LogIn, LogOut, Clock } from "lucide-react";
import { toggleAttendance } from "@/app/actions/attendance";

interface QuickPunchProps {
  employeeId: string;
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  checkInTime?: string | null;
}

export default function QuickPunch({
  employeeId,
  hasCheckedIn,
  hasCheckedOut,
  checkInTime,
}: QuickPunchProps) {
  const [time, setTime] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePunch = async () => {
    setLoading(true);
    await toggleAttendance(employeeId);
    setLoading(false);
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Quick Punch</span>
          <span className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
            <Clock className="w-3.5 h-3.5 animate-pulse" /> {time || "--:--:--"}
          </span>
        </div>
        <h3 className="text-base font-bold text-slate-800 mt-2">Web Attendance</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {hasCheckedOut
            ? "Completed your shift for today."
            : hasCheckedIn
            ? `Checked in at ${checkInTime}. Remember to punch out.`
            : "Mark your attendance for today."}
        </p>
      </div>

      <div className="mt-5">
        {!hasCheckedIn ? (
          <button
            onClick={handlePunch}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <LogIn className="w-4 h-4" />
            {loading ? "Recording..." : "Punch In"}
          </button>
        ) : !hasCheckedOut ? (
          <button
            onClick={handlePunch}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <LogOut className="w-4 h-4" />
            {loading ? "Recording..." : "Punch Out"}
          </button>
        ) : (
          <div className="w-full py-2 bg-slate-100 text-slate-500 text-center rounded-lg text-xs font-semibold">
            Shift Ended
          </div>
        )}
      </div>
    </div>
  );
}
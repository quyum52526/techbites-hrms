"use client";

import { useState, useEffect, useTransition } from "react";
import { LogIn, LogOut, CheckCircle2, Loader2, Clock } from "lucide-react";
import { clsx } from "clsx";
import { toggleAttendance } from "@/app/actions/attendance";

const ORG_TIME_ZONE = "Asia/Dhaka";

interface QuickPunchProps {
  /** ISO timestamps of today's punches, if any. */
  checkIn: string | null;
  checkOut: string | null;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
}

const formatClock = (date: Date) =>
  date.toLocaleTimeString("en-GB", { timeZone: ORG_TIME_ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const formatShort = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: ORG_TIME_ZONE, hour: "numeric", minute: "2-digit" });
const formatDay = (date: Date) =>
  date.toLocaleDateString("en-GB", { timeZone: ORG_TIME_ZONE, weekday: "long", day: "numeric", month: "short" });

/** "09:00" -> "09:00 AM" */
function to12Hour(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff > 0 ? diff : diff + 24 * 60;
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, "0")}m`;
}

export default function QuickPunch({ checkIn, checkOut, shiftName, shiftStart, shiftEnd }: QuickPunchProps) {
  // Starts null so the server render and first client render match; the clock fills in after mount.
  const [now, setNow] = useState<Date | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const hasCheckedIn = Boolean(checkIn);
  const hasCheckedOut = Boolean(checkOut);
  const state = hasCheckedOut ? "done" : hasCheckedIn ? "on-shift" : "idle";

  const workedMs = checkIn ? (checkOut ? new Date(checkOut) : now ?? new Date(checkIn)).getTime() - new Date(checkIn).getTime() : 0;
  const shiftMs = minutesBetween(shiftStart, shiftEnd) * 60_000;
  const progress = Math.min(100, Math.round((workedMs / shiftMs) * 100));

  const handlePunch = () => {
    setError(null);
    startTransition(async () => {
      try {
        await toggleAttendance();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not record your punch. Try again.");
      }
    });
  };

  const [clockMain, clockSeconds] = now ? [formatClock(now).slice(0, 5), formatClock(now).slice(6)] : ["--:--", "--"];

  return (
    <section
      aria-labelledby="quick-punch-title"
      className="relative overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm"
    >
      {/* Brand hairline */}
      <div aria-hidden className="h-1 bg-brand-gradient" />

      <div className="p-5">
        <div className="flex items-center justify-between">
          <h2 id="quick-punch-title" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Quick Punch
          </h2>
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold",
              state === "on-shift" && "bg-brand-50 text-brand-700",
              state === "done" && "bg-accent-50 text-accent-700",
              state === "idle" && "bg-slate-100 text-slate-600"
            )}
          >
            <span
              aria-hidden
              className={clsx(
                "w-1.5 h-1.5 rounded-full",
                state === "on-shift" && "bg-brand-500 motion-safe:animate-pulse",
                state === "done" && "bg-accent-600",
                state === "idle" && "bg-slate-400"
              )}
            />
            {state === "on-shift" ? "Punched in" : state === "done" ? "Shift complete" : "Not punched in"}
          </span>
        </div>

        {/* Clock */}
        <div className="mt-4 text-center">
          <p className="font-mono tabular-nums font-bold text-slate-900 leading-none" aria-live="off">
            <span className="text-4xl tracking-tight">{clockMain}</span>
            <span className="text-lg text-slate-500 ml-1">{clockSeconds}</span>
          </p>
          <p className="text-xs text-slate-600 mt-2">{now ? formatDay(now) : " "}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">
            <Clock className="w-3 h-3 text-brand-600" aria-hidden />
            <span>
              <span className="font-semibold">{shiftName}:</span> {to12Hour(shiftStart)} – {to12Hour(shiftEnd)}
            </span>
          </p>
        </div>

        {/* Punch summary */}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-surface-muted py-2">
            <dt className="text-[11px] text-slate-600">In</dt>
            <dd className="text-xs font-semibold text-slate-900 tabular-nums">{checkIn ? formatShort(checkIn) : "—"}</dd>
          </div>
          <div className="rounded-lg bg-surface-muted py-2">
            <dt className="text-[11px] text-slate-600">Out</dt>
            <dd className="text-xs font-semibold text-slate-900 tabular-nums">{checkOut ? formatShort(checkOut) : "—"}</dd>
          </div>
          <div className="rounded-lg bg-surface-muted py-2">
            <dt className="text-[11px] text-slate-600">Worked</dt>
            <dd className="text-xs font-semibold text-slate-900 tabular-nums">{checkIn ? formatDuration(workedMs) : "—"}</dd>
          </div>
        </dl>

        {hasCheckedIn && (
          <div className="mt-3">
            <div
              role="progressbar"
              aria-label="Shift progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-1.5 rounded-full bg-slate-100 overflow-hidden"
            >
              <div className="h-full bg-brand-gradient transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="mt-4">
          {state === "done" ? (
            <p className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent-50 text-accent-700 rounded-lg text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" aria-hidden /> Shift ended — see you tomorrow
            </p>
          ) : (
            <button
              type="button"
              onClick={handlePunch}
              disabled={isPending}
              className={clsx(
                "w-full min-h-11 flex items-center justify-center gap-2 px-4 rounded-lg text-sm font-semibold text-white shadow-sm transition-[transform,box-shadow,filter,opacity] duration-200 motion-safe:hover:-translate-y-px hover:shadow-md hover:brightness-110 disabled:opacity-70 disabled:cursor-wait",
                // In: cyan -> violet brand gradient. Out: solid logo violet (8.98:1 with white), distinct but on-brand.
                state === "idle" ? "bg-brand-gradient hover:shadow-brand-500/30" : "bg-accent-700 hover:bg-accent-800 hover:shadow-accent-500/30"
              )}
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden />
              ) : state === "idle" ? (
                <LogIn className="w-4 h-4" aria-hidden />
              ) : (
                <LogOut className="w-4 h-4" aria-hidden />
              )}
              {isPending ? "Recording…" : state === "idle" ? "Punch In" : "Punch Out"}
            </button>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs text-rose-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

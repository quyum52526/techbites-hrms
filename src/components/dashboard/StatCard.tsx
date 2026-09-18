import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

type Tone = "brand" | "accent" | "warning" | "success";

const toneStyles: Record<Tone, { icon: string; badge: string }> = {
  brand: { icon: "bg-brand-50 text-brand-700", badge: "bg-brand-50 text-brand-700" },
  accent: { icon: "bg-accent-50 text-accent-700", badge: "bg-accent-50 text-accent-700" },
  warning: { icon: "bg-amber-50 text-amber-700", badge: "bg-amber-50 text-amber-700" },
  success: { icon: "bg-emerald-50 text-emerald-700", badge: "bg-emerald-50 text-emerald-700" },
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Omit for roles that cannot open the page behind the number; the tile then renders static. */
  href?: string;
  icon: LucideIcon;
  tone: Tone;
  badge?: { label: string; tone?: Tone | "neutral" };
  hint?: string;
  /** Marks the tile whose filter is currently applied to the list below it. */
  active?: boolean;
  className?: string;
}

const tileClass = "relative flex flex-col gap-3 bg-white p-5 rounded-xl border shadow-sm";

/** KPI tile that drills down into the filtered list behind the number. */
export default function StatCard({ label, value, href, icon: Icon, tone, badge, hint, active = false, className }: StatCardProps) {
  const styles = toneStyles[tone];
  const badgeClass = !badge?.tone || badge.tone === "neutral" ? "bg-slate-100 text-slate-700" : toneStyles[badge.tone].badge;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className={clsx("p-2.5 rounded-lg", styles.icon)}>
          <Icon className="w-5 h-5" aria-hidden />
        </div>
        {href && (
          <ArrowUpRight
            className="w-4 h-4 text-slate-400 transition-colors duration-200 group-hover:text-brand-600"
            aria-hidden
          />
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-600">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
      </div>
      {(badge || hint) && (
        <div className="flex items-center gap-2 min-w-0">
          {badge && (
            <span className={clsx("shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold", badgeClass)}>{badge.label}</span>
          )}
          {hint && <span className="text-[11px] text-slate-600 truncate">{hint}</span>}
        </div>
      )}
    </>
  );

  if (!href) return <div className={clsx(tileClass, "border-slate-200", className)}>{body}</div>;

  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={clsx(
        tileClass,
        "group transition-[transform,box-shadow,border-color] duration-200 hover:shadow-md motion-safe:hover:-translate-y-0.5",
        active ? "border-brand-600 ring-1 ring-brand-600" : "border-slate-200 hover:border-brand-200",
        className
      )}
    >
      {body}
    </Link>
  );
}

"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { clsx } from "clsx";
import FormField from "@/components/ui/FormField";
import { controlClass } from "@/components/ui/styles";
import { parsePeriodParam } from "@/lib/payroll";

/** Payroll month selector; the page reads it from `?period=YYYY-MM`. Viewing another month changes nothing. */
export default function PayrollPeriodPicker({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startNavigation] = useTransition();

  return (
    <div className="relative w-44">
      <CalendarDays className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none z-10" aria-hidden />
      <FormField label="Payroll month" hideLabel>
        <input
          type="month"
          value={value}
          onChange={(event) => {
            if (!parsePeriodParam(event.target.value)) return;
            startNavigation(() => router.push(`${pathname}?period=${event.target.value}`));
          }}
          aria-busy={isNavigating || undefined}
          className={clsx(controlClass, "pl-8 py-1.5 text-xs font-medium", isNavigating && "opacity-60")}
        />
      </FormField>
    </div>
  );
}

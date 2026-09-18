"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { clsx } from "clsx";
import FormField from "@/components/ui/FormField";
import { controlClass } from "@/components/ui/styles";

interface CycleOption {
  id: string;
  label: string;
}

/** Switches the appraisal cycle through `?cycle=`, so the selection is linkable and survives a refresh. */
export default function CycleSelect({ cycles, selectedId }: { cycles: CycleOption[]; selectedId: string | undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, startNavigation] = useTransition();

  if (cycles.length === 0) return null;

  return (
    <div className="relative w-64 max-w-full">
      <CalendarDays className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-600 pointer-events-none" aria-hidden />
      <FormField label="Review cycle" hideLabel>
        <select
          value={selectedId}
          disabled={isNavigating}
          onChange={(e) => startNavigation(() => router.push(`${pathname}?cycle=${encodeURIComponent(e.target.value)}`))}
          className={clsx(controlClass, "pl-8 py-1.5 text-xs font-medium cursor-pointer")}
        >
          {cycles.map((cycle) => (
            <option key={cycle.id} value={cycle.id}>
              {cycle.label}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  );
}

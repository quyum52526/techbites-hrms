"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { clsx } from "clsx";
import { GUEST_READ_ONLY_MESSAGE } from "@/lib/auth-shared";

const ReadOnlyContext = createContext(false);

/** Set once in the dashboard layout: true for a guest session, so client components can hide their mutations. */
export function ReadOnlyProvider({ readOnly, children }: { readOnly: boolean; children: ReactNode }) {
  return <ReadOnlyContext.Provider value={readOnly}>{children}</ReadOnlyContext.Provider>;
}

/** Whether the viewer is a read-only guest. The server refuses their writes regardless; this only shapes the UI. */
export const useReadOnly = () => useContext(ReadOnlyContext);

/**
 * Stand-in for an action a guest cannot take: styled like the real control, visibly disabled, and explaining why on
 * hover. The wrapper carries the tooltip because disabled buttons receive no pointer events.
 */
export function GuestLockedButton({ children, className, fullWidth }: { children: ReactNode; className?: string; fullWidth?: boolean }) {
  return (
    <span title={GUEST_READ_ONLY_MESSAGE} className={clsx("cursor-not-allowed", fullWidth ? "flex" : "inline-flex")}>
      <button
        type="button"
        disabled
        className={clsx(className, "pointer-events-none inline-flex items-center justify-center gap-1.5 opacity-50", fullWidth && "w-full")}
      >
        <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden />
        {children}
        <span className="sr-only"> ({GUEST_READ_ONLY_MESSAGE})</span>
      </button>
    </span>
  );
}

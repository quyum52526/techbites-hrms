"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { primaryButtonClass } from "./styles";

/** Shape returned by the form server actions (`PayrollActionResult`, `SettingsActionResult`). */
export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const SUCCESS_VISIBLE_MS = 4000;

/**
 * Inline result of a form action. Success hides itself after a few seconds; an error stays until the next submit.
 * The wrapper is a persistent polite live region, so the message is announced when it appears.
 */
export function ActionFeedback({ state, className }: { state: ActionResult | null; className?: string }) {
  // Each submit returns a new object, so remembering the hidden one lets a repeat save show its message again.
  const [hidden, setHidden] = useState<ActionResult | null>(null);

  useEffect(() => {
    if (!state?.ok) return;
    const timer = setTimeout(() => setHidden(state), SUCCESS_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const visible = state && state !== hidden ? state : null;

  return (
    <div aria-live="polite" className={clsx(!visible && "sr-only", className)}>
      {visible?.ok && (
        <p className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {visible.message}
        </p>
      )}
      {visible && !visible.ok && (
        <p role="alert" className="px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 font-medium">
          {visible.error}
        </p>
      )}
    </div>
  );
}

/** Primary submit button that disables itself and swaps its label while the form action runs. */
export function SubmitButton({
  pending,
  children,
  pendingLabel = "Saving…",
  icon,
  className,
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(primaryButtonClass, "inline-flex items-center justify-center gap-2", className)}
    >
      {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : icon}
      {pending ? pendingLabel : children}
    </button>
  );
}

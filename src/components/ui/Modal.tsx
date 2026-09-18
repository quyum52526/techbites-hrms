"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

const sizeClass = { md: "max-w-md", lg: "max-w-lg", "2xl": "max-w-2xl" } as const;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** First real form control; visually hidden inputs (e.g. a styled file picker) are skipped. */
const FIRST_FIELD = 'input:not([disabled]):not([type="hidden"]):not(.sr-only), select:not([disabled]), textarea:not([disabled])';

/** Keeps Tab / Shift+Tab cycling inside a modal dialog instead of escaping to the browser chrome. */
export function trapTabKey(event: React.KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const focusables = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Closes a modal <dialog> on a backdrop click. The press must also start on the backdrop, so selecting text
 * inside the panel and releasing outside does not close it.
 */
export function useBackdropClose() {
  const pressStartedOnBackdrop = useRef(false);
  return {
    onPointerDown: (event: React.PointerEvent<HTMLDialogElement>) => {
      pressStartedOnBackdrop.current = event.target === event.currentTarget;
    },
    onClick: (event: React.MouseEvent<HTMLDialogElement>) => {
      if (pressStartedOnBackdrop.current && event.target === event.currentTarget) event.currentTarget.close();
    },
  };
}

interface ModalProps {
  open: boolean;
  /** Called for Esc, backdrop click and the close button. The parent owns `open`. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: keyof typeof sizeClass;
  children: ReactNode;
}

/**
 * Modal on the native <dialog> element: showModal() gives top-layer stacking, an inert background and Esc for free.
 * On top of that: focus moves to `[data-autofocus]` or the first field, Tab is trapped, a backdrop click closes,
 * and focus returns to the element that opened it.
 */
export default function Modal({ open, onClose, title, description, size = "md", children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const backdropClose = useBackdropClose();
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      const target = dialog.querySelector<HTMLElement>("[data-autofocus]") ?? dialog.querySelector<HTMLElement>(FIRST_FIELD) ?? dialog;
      target.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      // Esc and dialog.close() both end here, so the parent's state always follows the native dialog.
      onClose={() => {
        onClose();
        returnFocusRef.current?.focus();
      }}
      onKeyDown={trapTabKey}
      {...backdropClose}
      className={clsx(
        "dialog-modal m-auto w-[calc(100%-2rem)] max-h-[90dvh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl focus:outline-none open:flex",
        sizeClass[size]
      )}
    >
      {open && (
        <>
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-100">
            <div>
              <h2 id={titleId} className="text-sm font-semibold text-slate-900">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-0.5 text-xs text-slate-600">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => dialogRef.current?.close()}
              className="-m-1.5 p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors duration-150"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto">{children}</div>
        </>
      )}
    </dialog>
  );
}

/** Footer row for forms inside a Modal: secondary action first, primary last. */
export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-slate-100">{children}</div>;
}

export const secondaryButtonClass =
  "px-4 py-2 rounded-lg border border-control text-slate-700 font-medium hover:bg-slate-50 transition-colors duration-150";
export const primaryButtonClass =
  "px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed";

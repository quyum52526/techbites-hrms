"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { CircleHelp, Loader2, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from "./styles";

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
  /** Shown left of the title, e.g. a tinted status icon. */
  icon?: ReactNode;
  /** "alertdialog" for confirmations that interrupt the user and need a decision. */
  role?: "dialog" | "alertdialog";
  /** false blocks Esc, backdrop click and the close button, e.g. while a confirmed action is running. */
  dismissible?: boolean;
  /**
   * Pinned below the scrolling body so it never scrolls out of view, e.g. a long form's Cancel/Save buttons.
   * Buttons here sit outside the <form>, so link the submit button with the `form` attribute.
   */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Modal on the native <dialog> element: showModal() gives top-layer stacking, an inert background and Esc for free.
 * On top of that: focus moves to `[data-autofocus]` or the first field, Tab is trapped, a backdrop click closes,
 * and focus returns to the element that opened it.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  icon,
  role,
  dismissible = true,
  footer,
  children,
}: ModalProps) {
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
      role={role}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      // Esc and dialog.close() both end here, so the parent's state always follows the native dialog.
      onClose={() => {
        onClose();
        returnFocusRef.current?.focus();
      }}
      // Esc fires "cancel" first; cancelling it keeps the dialog open.
      onCancel={dismissible ? undefined : (event) => event.preventDefault()}
      onKeyDown={trapTabKey}
      {...(dismissible ? backdropClose : {})}
      className={clsx(
        "dialog-modal m-auto w-[calc(100%-2rem)] max-h-[90dvh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl focus:outline-none open:flex",
        sizeClass[size]
      )}
    >
      {open && (
        <>
          <div className="flex shrink-0 items-start gap-3 px-4 sm:px-6 py-4 border-b border-slate-100">
            {icon}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-sm font-semibold text-slate-900 break-words">
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
              disabled={!dismissible}
              onClick={() => dialogRef.current?.close()}
              className="-m-1.5 p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors duration-150 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>
          {/* min-h-0 lets the body shrink inside the height-capped dialog, so it scrolls instead of overflowing. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          {footer && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80">
              {footer}
            </div>
          )}
        </>
      )}
    </dialog>
  );
}

/** Footer row for forms inside a Modal: secondary action first, primary last. */
export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-slate-100">{children}</div>;
}

const confirmTone = {
  primary: { icon: CircleHelp, badge: "bg-brand-50 text-brand-700", button: primaryButtonClass },
  danger: { icon: TriangleAlert, badge: "bg-rose-50 text-rose-700", button: dangerButtonClass },
} as const;

interface ConfirmModalProps {
  open: boolean;
  /** Cancel, Esc, backdrop click and the close button. Blocked while `pending`. */
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  /** The consequence of confirming, in one or two sentences. Announced as the dialog's description. */
  description: ReactNode;
  /** Optional extra detail between the header and the buttons. */
  children?: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  /** "danger" for irreversible actions: warning icon, rose confirm button, and Cancel gets initial focus. */
  tone?: keyof typeof confirmTone;
  icon?: LucideIcon;
  pending?: boolean;
  /** Shown inside the dialog so the user can retry or cancel without losing context. */
  error?: string | null;
}

/** Replaces window.confirm()/alert(): a Modal with role="alertdialog", a consequence line and Cancel/Confirm. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  icon,
  pending = false,
  error,
}: ConfirmModalProps) {
  const style = confirmTone[tone];
  const Icon = icon ?? style.icon;
  // Destructive: focus the safe choice so a stray Enter does not delete. Otherwise focus the action.
  const focusCancel = tone === "danger";

  return (
    <Modal
      open={open}
      onClose={onClose}
      role="alertdialog"
      dismissible={!pending}
      title={title}
      description={description}
      icon={
        <span className={clsx("grid place-items-center w-9 h-9 rounded-full shrink-0", style.badge)}>
          <Icon className="w-4 h-4" aria-hidden />
        </span>
      }
    >
      <div className="px-6 py-4 space-y-4 text-xs">
        {children}
        {error && (
          <p role="alert" className="px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 font-medium">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} disabled={pending} data-autofocus={focusCancel || undefined} className={secondaryButtonClass}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            data-autofocus={focusCancel ? undefined : true}
            className={clsx(style.button, "inline-flex items-center gap-2")}
          >
            {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

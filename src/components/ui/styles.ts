/*
 * Shared class strings for form controls and buttons. This module has no "use client" directive on purpose:
 * values exported from a client module reach Server Components as client references, not strings, so the
 * server-rendered forms (Payroll, Settings) could not use them.
 */

/**
 * Card container shared by panels and KPI tiles: surface fill, rounded-xl, 1px border, shadow-sm.
 * `cardShellClass` leaves the border colour to the caller (interactive tiles switch it on hover/active);
 * static panels use `cardClass`. Only cards that link somewhere get hover lift, so hover always means "clickable".
 */
export const cardShellClass = "bg-surface rounded-xl border shadow-sm";
export const cardClass = `${cardShellClass} border-slate-200`;

/** Text inputs, selects and textareas. `aria-invalid` switches the border to the error colour. */
export const controlClass =
  "w-full rounded-lg border border-control bg-white p-2 text-slate-900 placeholder:text-slate-500 transition-[border-color,box-shadow] duration-150 hover:border-slate-500 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 disabled:bg-slate-100 disabled:text-slate-600 aria-invalid:border-rose-700 aria-invalid:focus:ring-rose-700/30";

/** A value shown inside a form but not editable there: still focusable and readable, visibly not a live field. */
export const readOnlyControlClass =
  "w-full rounded-lg border border-slate-200 bg-surface-muted p-2 text-slate-700 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30";

const buttonBase = "px-4 py-2 rounded-lg transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed";

export const secondaryButtonClass = `${buttonBase} border border-control text-slate-700 font-medium hover:bg-slate-50`;
export const primaryButtonClass = `${buttonBase} bg-brand-600 hover:bg-brand-700 text-white font-semibold`;
/** Irreversible actions only (delete). White on rose-700 = 6.0:1. */
export const dangerButtonClass = `${buttonBase} bg-rose-700 hover:bg-rose-800 text-white font-semibold`;

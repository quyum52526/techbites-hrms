"use client";

import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import { clsx } from "clsx";

/** Shared look for text inputs, selects and textareas. `aria-invalid` switches the border to the error colour. */
export const controlClass =
  "w-full rounded-lg border border-control bg-white p-2 text-slate-900 placeholder:text-slate-500 transition-[border-color,box-shadow] duration-150 hover:border-slate-500 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 disabled:bg-slate-100 disabled:text-slate-600 aria-invalid:border-rose-700 aria-invalid:focus:ring-rose-700/30";

type ControlProps = {
  id?: string;
  required?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

interface FormFieldProps {
  label: ReactNode;
  /** Exactly one input, select or textarea; FormField wires its id and ARIA attributes. */
  children: ReactElement<ControlProps>;
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  /** Renders the label visually hidden, e.g. when a column heading already names the field. */
  hideLabel?: boolean;
}

/**
 * Label + control + hint + error with the accessibility wiring done once:
 * `htmlFor`/`id` via useId, `aria-describedby` for hint and error, `aria-invalid` and `required` on the control.
 */
export default function FormField({ label, children, required, hint, error, className, hideLabel }: FormFieldProps) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const isRequired = required ?? children.props.required ?? false;

  const describedBy = [children.props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={clsx("space-y-1", className)}>
      <label htmlFor={id} className={clsx("block text-xs font-medium text-slate-700", hideLabel && "sr-only")}>
        {label}
        {isRequired && (
          <span aria-hidden className="ml-0.5 text-rose-700">
            *
          </span>
        )}
      </label>
      {cloneElement(children, {
        id,
        required: isRequired,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })}
      {hint && (
        <p id={hintId} className="text-[11px] text-slate-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-[11px] font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

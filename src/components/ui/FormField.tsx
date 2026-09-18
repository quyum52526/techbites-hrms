"use client";

import { cloneElement, useId, type ReactElement, type ReactNode } from "react";
import { clsx } from "clsx";

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
 * Style the control with `controlClass` from `./styles`. Server Components can render this too: pass the
 * control as a plain element child.
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

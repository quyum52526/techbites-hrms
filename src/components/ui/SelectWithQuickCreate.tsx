"use client";

import { useId, useRef, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { clsx } from "clsx";
import { controlClass } from "./styles";

export type SelectOption = { value: string; label: string };

interface Props {
  label: string;
  /** Submitted with the surrounding form. The inline name input has no name, so it is never submitted. */
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  /** Lower-case noun for the inline form, e.g. "department". */
  noun: string;
  hint?: string;
  /** Hint shown under the inline name input, e.g. which company the new department belongs to. */
  createHint?: string;
  /** Creates the record; on success the caller adds it to `options`, and this component selects it. */
  onCreate: (name: string) => Promise<{ ok: true; option: SelectOption } | { ok: false; error: string }>;
}

const iconButtonClass =
  "inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg border transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed";

/**
 * A select with a "+ New" link that opens an inline name field beneath it. Enter creates, Esc cancels; neither
 * submits nor closes the surrounding form or dialog, and focus returns to the select afterwards.
 */
export default function SelectWithQuickCreate({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  noun,
  hint,
  createHint,
  onCreate,
}: Props) {
  const selectId = useId();
  const createInputId = useId();
  const createHintId = useId();
  const createErrorId = useId();
  const hintId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setCreating(false);
    setDraft("");
    setError(null);
    // After the panel unmounts, so focus lands on the select rather than on nothing.
    requestAnimationFrame(() => selectRef.current?.focus());
  };

  const submit = async () => {
    if (pending) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      setError(`Enter a ${noun} name`);
      return;
    }
    if (options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" is already in the list`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await onCreate(trimmed);
      if (result.ok) {
        onChange(result.option.value);
        close();
      } else {
        setError(result.error);
      }
    } catch {
      setError(`Failed to create the ${noun}`);
    } finally {
      setPending(false);
    }
  };

  const describedBy = [createHint ? createHintId : null, error ? createErrorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={selectId} className="block text-xs font-medium text-slate-700">
          {label}
        </label>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-0.5 rounded px-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/30"
          >
            <Plus className="w-3 h-3" aria-hidden /> New<span className="sr-only"> {noun}</span>
          </button>
        )}
      </div>

      <select
        ref={selectRef}
        id={selectId}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? hintId : undefined}
        className={controlClass}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={hintId} className="text-[11px] text-slate-600">
          {hint}
        </p>
      )}

      {creating && (
        <div role="group" aria-label={`New ${noun}`} className="mt-2 p-2.5 rounded-lg border border-brand-200 bg-brand-50/50 space-y-1.5">
          <label htmlFor={createInputId} className="block text-[11px] font-medium text-slate-700">
            New {noun} name
          </label>
          <div className="flex items-center gap-1.5">
            <input
              id={createInputId}
              autoFocus
              value={draft}
              maxLength={100}
              autoComplete="off"
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                // Enter would submit the employee form, Esc would close the dialog: both stay inside this field.
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  close();
                }
              }}
              readOnly={pending}
              aria-busy={pending || undefined}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={clsx(controlClass, "py-1.5")}
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={pending}
              aria-label={`Create ${noun}`}
              className={clsx(iconButtonClass, "border-brand-600 bg-brand-600 text-white hover:bg-brand-700")}
            >
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Check className="w-3.5 h-3.5" aria-hidden />}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={pending}
              aria-label="Cancel"
              className={clsx(iconButtonClass, "border-control bg-white text-slate-700 hover:bg-slate-50")}
            >
              <X className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
          {createHint && (
            <p id={createHintId} className="text-[11px] text-slate-600">
              {createHint}
            </p>
          )}
          {error && (
            <p id={createErrorId} role="alert" className="text-[11px] font-medium text-rose-700">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

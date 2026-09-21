"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { clsx } from "clsx";
import { MAX_IMPORT_FILE_BYTES, type ImportResult } from "@/lib/import-result";
import Modal, { ModalActions } from "@/components/ui/Modal";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/styles";
import { GuestLockedButton, useReadOnly } from "@/components/ui/ReadOnly";

const triggerClass =
  "flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-control text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors duration-200";

interface Props {
  buttonLabel: string;
  title: string;
  description: string;
  columns: { name: string; required?: boolean; hint?: string }[];
  templateHref: string;
  action: (formData: FormData) => Promise<ImportResult>;
}

const MAX_VISIBLE_ISSUES = 200;

export default function CsvImportModal({ buttonLabel, title, description, columns, templateHref, action }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const readOnly = useReadOnly();

  const reset = () => {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    setIsOpen(false);
    reset();
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setResult({ ok: false, message: "CSV file is larger than 3 MB — split it into smaller files", stats: [], issues: [] });
      return;
    }
    setLoading(true);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      setResult(await action(formData));
    } catch {
      setResult({ ok: false, message: "Upload failed. Check your connection and try again.", stats: [], issues: [] });
    } finally {
      setLoading(false);
    }
  };

  if (readOnly) return <GuestLockedButton className={triggerClass}>{buttonLabel}</GuestLockedButton>;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        className={triggerClass}
      >
        <Upload className="w-4 h-4" aria-hidden /> {buttonLabel}
      </button>

      <Modal open={isOpen} onClose={close} title={title} size="2xl">
        <form onSubmit={handleSubmit} autoComplete="off" className="p-6 space-y-4 text-xs">
          <p className="text-slate-700">{description}</p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-900">Expected columns</span>
              <a
                href={templateHref}
                download
                className="flex items-center gap-1.5 text-brand-700 hover:text-brand-900 font-semibold hover:underline"
              >
                <Download className="w-3.5 h-3.5" /> Download sample template
              </a>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {columns.map((col) => (
                <span
                  key={col.name}
                  title={col.hint}
                  className={clsx(
                    "font-mono text-[11px] px-2 py-0.5 rounded border",
                    col.required ? "bg-brand-50 border-brand-200 text-brand-900 font-semibold" : "bg-white border-slate-200 text-slate-800"
                  )}
                >
                  {col.name}
                  {col.required && " *"}
                </span>
              ))}
            </div>
            {columns.some((c) => c.hint) && (
              <ul className="text-[11px] text-slate-700 space-y-0.5">
                {columns.filter((c) => c.hint).map((c) => (
                  <li key={c.name}>
                    <span className="font-mono font-semibold text-slate-900">{c.name}</span>: {c.hint}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* The label wraps the visually hidden input, so the whole drop area is its accessible name and click target. */}
          <label className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-control hover:border-brand-600 cursor-pointer bg-white transition-colors duration-150 has-[:focus-visible]:border-brand-600 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600/30">
            <FileSpreadsheet className="w-6 h-6 text-brand-600 shrink-0" aria-hidden />
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-slate-900 truncate">{file ? file.name : "Choose a .csv file"}</span>
              <span className="block text-[11px] text-slate-600">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : "Max 3 MB, UTF-8, first row must be the header"}
              </span>
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              autoComplete="off"
              data-autofocus
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
              }}
            />
          </label>

          {result && (
            <div className="space-y-3">
              <p
                role={result.ok ? "status" : "alert"}
                className={clsx(
                  "px-3 py-2 rounded-lg font-semibold border",
                  result.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-300 text-rose-800"
                )}
              >
                {result.message}
              </p>

              {result.stats.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {result.stats.map((stat) => (
                    <div key={stat.label} className="rounded-lg border border-slate-200 px-3 py-2">
                      <p className="text-[11px] text-slate-600 font-medium">{stat.label}</p>
                      <p className="text-base font-bold text-slate-900 tabular-nums">{stat.value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}

              {result.issues.length > 0 && (
                <div className="rounded-lg border border-rose-300 overflow-hidden">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-rose-50 text-rose-800 sticky top-0">
                        <tr>
                          <th className="py-1.5 px-3 font-semibold w-16">Line</th>
                          <th className="py-1.5 px-3 font-semibold">Issue</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100">
                        {result.issues.slice(0, MAX_VISIBLE_ISSUES).map((issue, i) => (
                          <tr key={i}>
                            <td className="py-1.5 px-3 font-mono text-slate-900">{issue.line}</td>
                            <td className="py-1.5 px-3 text-slate-900 font-medium">{issue.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.issues.length > MAX_VISIBLE_ISSUES && (
                    <p className="px-3 py-1.5 bg-rose-50 text-rose-800 font-medium border-t border-rose-200">
                      …and {(result.issues.length - MAX_VISIBLE_ISSUES).toLocaleString()} more
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <ModalActions>
            <button type="button" onClick={result?.ok ? close : reset} className={secondaryButtonClass}>
              {result?.ok ? "Done" : "Clear"}
            </button>
            <button type="submit" disabled={!file || loading} className={primaryButtonClass}>
              {loading ? "Importing…" : "Upload & Import"}
            </button>
          </ModalActions>
        </form>
      </Modal>
    </>
  );
}

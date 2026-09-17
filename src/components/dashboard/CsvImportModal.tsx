"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { clsx } from "clsx";
import { MAX_IMPORT_FILE_BYTES, type ImportResult } from "@/lib/import-result";

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

  const reset = () => {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    setIsOpen(false);
    reset();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold px-4 py-2 rounded-lg shadow-sm"
      >
        <Upload className="w-4 h-4" /> {buttonLabel}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
              <button onClick={close} className="text-slate-500 hover:text-slate-800" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off" className="p-6 space-y-4 text-xs overflow-y-auto">
              <p className="text-slate-700">{description}</p>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-900">Expected columns</span>
                  <a
                    href={templateHref}
                    download
                    className="flex items-center gap-1.5 text-indigo-700 hover:text-indigo-900 font-semibold hover:underline"
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
                        col.required ? "bg-indigo-50 border-indigo-200 text-indigo-900 font-semibold" : "bg-white border-slate-200 text-slate-800"
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

              <label className="flex items-center gap-3 p-4 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-400 cursor-pointer bg-white">
                <FileSpreadsheet className="w-6 h-6 text-indigo-600 shrink-0" />
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
                    className={clsx(
                      "px-3 py-2 rounded-lg font-semibold text-black border",
                      result.ok ? "bg-emerald-100 border-emerald-300" : "bg-red-100 border-red-300"
                    )}
                  >
                    {result.message}
                  </p>

                  {result.stats.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {result.stats.map((stat) => (
                        <div key={stat.label} className="rounded-lg border border-slate-200 px-3 py-2">
                          <p className="text-[10px] text-slate-600 font-medium">{stat.label}</p>
                          <p className="text-base font-bold text-slate-900 tabular-nums">{stat.value.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.issues.length > 0 && (
                    <div className="rounded-lg border border-red-300 overflow-hidden">
                      <div className="max-h-56 overflow-y-auto">
                        <table className="w-full text-left">
                          <thead className="bg-red-100 text-black sticky top-0">
                            <tr>
                              <th className="py-1.5 px-3 font-semibold w-16">Line</th>
                              <th className="py-1.5 px-3 font-semibold">Issue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100">
                            {result.issues.slice(0, MAX_VISIBLE_ISSUES).map((issue, i) => (
                              <tr key={i}>
                                <td className="py-1.5 px-3 font-mono text-black">{issue.line}</td>
                                <td className="py-1.5 px-3 text-black font-medium">{issue.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {result.issues.length > MAX_VISIBLE_ISSUES && (
                        <p className="px-3 py-1.5 bg-red-50 text-black font-medium border-t border-red-200">
                          …and {(result.issues.length - MAX_VISIBLE_ISSUES).toLocaleString()} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={result?.ok ? close : reset}
                  className="px-4 py-2 border border-slate-300 text-slate-800 font-medium rounded-lg hover:bg-slate-50"
                >
                  {result?.ok ? "Done" : "Clear"}
                </button>
                <button
                  type="submit"
                  disabled={!file || loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-semibold"
                >
                  {loading ? "Importing..." : "Upload & Import"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

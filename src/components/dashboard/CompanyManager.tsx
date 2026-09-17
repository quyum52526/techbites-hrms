"use client";

import { useState } from "react";
import { Building, Plus, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { createCompany, deleteCompany } from "@/app/actions/company";

interface Company {
  id: string;
  name: string;
  code: string;
  isParent: boolean;
  employeeCount: number;
}

export default function CompanyManager({ companies }: { companies: Company[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const closeModal = () => {
    setIsOpen(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const result = await createCompany({
        name: formData.get("name") as string,
        code: formData.get("code") as string,
        isParent: formData.get("isParent") === "on",
      });
      if (result.ok) closeModal();
      else setError(result.error);
    } catch {
      setError("Failed to create company");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (company: Company) => {
    if (!confirm(`Delete ${company.name} (${company.code})? This cannot be undone.`)) return;
    setDeletingId(company.id);
    try {
      const result = await deleteCompany(company.id);
      if (!result.ok) alert(result.error);
    } catch {
      alert("Failed to delete company");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 font-semibold text-sm text-slate-800">
          <Building className="w-4 h-4 text-sky-600" />
          <span>Sister Concerns & Companies</span>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add Company
        </button>
      </div>

      {companies.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">No companies configured yet. Add your parent company to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 pr-3 font-medium">Company Name</th>
                <th className="py-2 pr-3 font-medium">Code</th>
                <th className="py-2 pr-3 font-medium text-right">Total Employees</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 font-medium sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 pr-3 font-medium text-slate-700">{company.name}</td>
                  <td className="py-2.5 pr-3">
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{company.code}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">{company.employeeCount}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={clsx(
                        "px-2.5 py-0.5 rounded-full font-semibold text-[10px]",
                        company.isParent ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"
                      )}
                    >
                      {company.isParent ? "Parent" : "Sister"}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => handleDelete(company)}
                      disabled={deletingId === company.id}
                      title={`Delete ${company.name}`}
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-sm">Add Company / Sister Concern</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Company Name *</label>
                <input
                  name="name"
                  required
                  placeholder="TechBites Media"
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Short Code *</label>
                <input
                  name="code"
                  required
                  maxLength={10}
                  placeholder="TBM"
                  className="w-full border border-slate-200 rounded-lg p-2 font-mono uppercase focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">2–10 characters, must be unique across companies.</span>
              </div>

              <label className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input type="checkbox" name="isParent" className="mt-0.5 accent-indigo-600" />
                <span>
                  <span className="block font-medium text-slate-700">Parent company</span>
                  <span className="block text-[10px] text-slate-400">Only one parent is allowed — the current parent becomes a sister concern.</span>
                </span>
              </label>

              {error && <p className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">{error}</p>}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-semibold"
                >
                  {loading ? "Saving..." : "Create Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Building, Pencil, Plus, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import { createCompany, deleteCompany, updateCompany } from "@/app/actions/company";
import CompanyLogo from "@/components/dashboard/CompanyLogo";

interface Company {
  id: string;
  name: string;
  code: string;
  isParent: boolean;
  logoUrl: string | null;
  address: string | null;
  binNumber: string | null;
  phone: string | null;
  email: string | null;
  employeeCount: number;
}

type ModalState = { mode: "create" } | { mode: "edit"; company: Company } | null;

const inputClass =
  "w-full border border-slate-200 rounded-lg p-2 text-slate-900 bg-white font-medium placeholder:text-slate-500 placeholder:font-normal focus:ring-2 focus:ring-brand-600 outline-none";
const labelClass = "block text-slate-600 font-medium mb-1";

export default function CompanyManager({ companies }: { companies: Company[] }) {
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  const editing = modal?.mode === "edit" ? modal.company : null;

  const openModal = (state: NonNullable<ModalState>) => {
    setError(null);
    setLogoPreview(state.mode === "edit" ? state.company.logoUrl ?? "" : "");
    setModal(state);
  };

  const closeModal = () => {
    setModal(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const result = editing ? await updateCompany(editing.id, formData) : await createCompany(formData);
      if (result.ok) closeModal();
      else setError(result.error);
    } catch {
      setError(editing ? "Failed to update company" : "Failed to create company");
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
          <Building className="w-4 h-4 text-brand-600" />
          <span>Sister Concerns & Companies</span>
        </div>
        <button
          onClick={() => openModal({ mode: "create" })}
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add Company
        </button>
      </div>

      {companies.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">No companies configured yet. Add your parent company to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-2 pr-3 font-medium">Company Name</th>
                <th className="py-2 pr-3 font-medium">Code</th>
                <th className="py-2 pr-3 font-medium">BIN / Tax ID</th>
                <th className="py-2 pr-3 font-medium text-right">Total Employees</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 font-medium sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-slate-50/60">
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <CompanyLogo name={company.name} logoUrl={company.logoUrl} />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-700">{company.name}</p>
                        {(company.email || company.phone) && (
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {[company.email, company.phone].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{company.code}</span>
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-slate-600">{company.binNumber ?? <span className="text-slate-500">—</span>}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-slate-700">{company.employeeCount}</td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={clsx(
                        "px-2.5 py-0.5 rounded-full font-semibold text-[11px]",
                        company.isParent ? "bg-brand-50 text-brand-700" : "bg-emerald-50 text-emerald-700"
                      )}
                    >
                      {company.isParent ? "Parent" : "Sister"}
                    </span>
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => openModal({ mode: "edit", company })}
                      title={`Edit ${company.name}`}
                      className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(company)}
                      disabled={deletingId === company.id}
                      title={`Delete ${company.name}`}
                      className="p-1.5 rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50"
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

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-sm">
                {editing ? `Edit ${editing.name}` : "Add Company / Sister Concern"}
              </h3>
              <button onClick={closeModal} className="text-slate-500 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* key resets the uncontrolled defaults when switching between companies */}
            <form key={editing?.id ?? "create"} onSubmit={handleSubmit} autoComplete="off" className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Company Name *</label>
                  <input
                    name="name"
                    required
                    autoComplete="off"
                    defaultValue={editing?.name}
                    placeholder="TechBites Media"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Short Code *</label>
                  <input
                    name="code"
                    required
                    maxLength={10}
                    autoComplete="off"
                    defaultValue={editing?.code}
                    placeholder="TBM"
                    className={clsx(inputClass, "font-mono uppercase")}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Company Logo URL</label>
                <div className="flex items-center gap-2.5">
                  <CompanyLogo name={editing?.name ?? "New Company"} logoUrl={logoPreview.trim() || null} className="w-9 h-9" />
                  <input
                    name="logoUrl"
                    autoComplete="off"
                    value={logoPreview}
                    onChange={(e) => setLogoPreview(e.target.value)}
                    placeholder="Optional, e.g. /logos/lmt.png or https://..."
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>BIN / Tax ID</label>
                <input
                  name="binNumber"
                  autoComplete="off"
                  defaultValue={editing?.binNumber ?? ""}
                  placeholder="Optional"
                  className={clsx(inputClass, "font-mono")}
                />
              </div>

              <div>
                <label className={labelClass}>Address</label>
                <textarea
                  name="address"
                  rows={2}
                  autoComplete="off"
                  defaultValue={editing?.address ?? ""}
                  placeholder="Optional"
                  className={clsx(inputClass, "resize-none")}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Phone</label>
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="off"
                    defaultValue={editing?.phone ?? ""}
                    placeholder="Optional"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    name="email"
                    type="email"
                    autoComplete="off"
                    defaultValue={editing?.email ?? ""}
                    placeholder="Optional"
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                <input type="checkbox" name="isParent" defaultChecked={editing?.isParent} className="mt-0.5 accent-brand-600" />
                <span>
                  <span className="block font-medium text-slate-700">Parent company</span>
                  <span className="block text-[11px] text-slate-500">Only one parent is allowed — the current parent becomes a sister concern.</span>
                </span>
              </label>

              {error && (
                <p className="px-3 py-2 rounded-lg bg-red-100 text-black font-semibold border border-red-300">
                  {error}
                </p>
              )}

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
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-lg font-semibold"
                >
                  {loading ? "Saving..." : editing ? "Save Changes" : "Create Company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

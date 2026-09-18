"use client";

import { useState } from "react";
import { Building, Pencil, Plus, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { createCompany, deleteCompany, updateCompany } from "@/app/actions/company";
import CompanyLogo from "@/components/dashboard/CompanyLogo";
import Modal, { ConfirmModal, ModalActions } from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import { controlClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/styles";

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

export default function CompanyManager({ companies }: { companies: Company[] }) {
  const [modal, setModal] = useState<ModalState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
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

  const openDelete = (company: Company) => {
    setDeleteError(null);
    setDeleteTarget(company);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteCompany(deleteTarget.id);
      if (result.ok) setDeleteTarget(null);
      else setDeleteError(result.error);
    } catch {
      setDeleteError("Failed to delete company. Please try again.");
    } finally {
      setDeleting(false);
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
                      aria-label={`Edit ${company.name}`}
                      title={`Edit ${company.name}`}
                      className="p-1.5 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors duration-150"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <button
                      onClick={() => openDelete(company)}
                      aria-label={`Delete ${company.name}`}
                      title={`Delete ${company.name}`}
                      className="p-1.5 rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors duration-150"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={closeModal}
        size="lg"
        title={editing ? `Edit ${editing.name}` : "Add Company / Sister Concern"}
      >
        {/* key resets the uncontrolled defaults when switching between companies */}
        <form key={editing?.id ?? "create"} onSubmit={handleSubmit} autoComplete="off" className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Company name" required className="sm:col-span-2">
              <input name="name" autoComplete="off" defaultValue={editing?.name} placeholder="TechBites Media" className={controlClass} />
            </FormField>
            <FormField label="Short code" required hint="Up to 10 characters">
              <input
                name="code"
                maxLength={10}
                autoComplete="off"
                defaultValue={editing?.code}
                placeholder="TBM"
                className={clsx(controlClass, "font-mono uppercase")}
              />
            </FormField>
          </div>

          <div className="flex items-start gap-2.5">
            <CompanyLogo name={editing?.name ?? "New Company"} logoUrl={logoPreview.trim() || null} className="w-9 h-9 mt-5 shrink-0" />
            <FormField label="Company logo URL" hint="Optional, e.g. /logos/lmt.png or https://…" className="flex-1">
              <input
                name="logoUrl"
                autoComplete="off"
                value={logoPreview}
                onChange={(e) => setLogoPreview(e.target.value)}
                className={controlClass}
              />
            </FormField>
          </div>

          <FormField label="BIN / Tax ID">
            <input name="binNumber" autoComplete="off" defaultValue={editing?.binNumber ?? ""} placeholder="Optional" className={clsx(controlClass, "font-mono")} />
          </FormField>

          <FormField label="Address">
            <textarea name="address" rows={2} autoComplete="off" defaultValue={editing?.address ?? ""} placeholder="Optional" className={clsx(controlClass, "resize-none")} />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Phone">
              <input name="phone" type="tel" autoComplete="off" defaultValue={editing?.phone ?? ""} placeholder="Optional" className={controlClass} />
            </FormField>
            <FormField label="Email">
              <input name="email" type="email" autoComplete="off" defaultValue={editing?.email ?? ""} placeholder="Optional" className={controlClass} />
            </FormField>
          </div>

          <label className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-surface-muted cursor-pointer">
            <input type="checkbox" name="isParent" defaultChecked={editing?.isParent} className="mt-0.5 w-4 h-4 accent-brand-600" />
            <span>
              <span className="block font-medium text-slate-800">Parent company</span>
              <span className="block text-[11px] text-slate-600">Only one parent is allowed — the current parent becomes a sister concern.</span>
            </span>
          </label>

          {error && (
            <p role="alert" className="px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 font-medium">
              {error}
            </p>
          )}

          <ModalActions>
            <button type="button" onClick={closeModal} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className={primaryButtonClass}>
              {loading ? "Saving…" : editing ? "Save Changes" : "Create Company"}
            </button>
          </ModalActions>
        </form>
      </Modal>

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        tone="danger"
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : ""}
        description={
          deleteTarget
            ? `${deleteTarget.name} (${deleteTarget.code}) will be permanently removed. Its departments are kept but detached. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete Company"
        pendingLabel="Deleting…"
        pending={deleting}
        error={deleteError}
      />
    </div>
  );
}

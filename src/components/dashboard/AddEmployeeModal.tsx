"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { createEmployee } from "@/app/actions/employees";
import Modal, { ModalActions, primaryButtonClass, secondaryButtonClass } from "@/components/ui/Modal";
import FormField, { controlClass } from "@/components/ui/FormField";

interface Props {
  companies: { id: string; name: string; code: string }[];
  departments: { id: string; name: string; companyId: string | null }[];
  designations: { id: string; title: string }[];
  activeCompanyId: string | null;
}

export default function AddEmployeeModal({ companies, departments, designations, activeCompanyId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(activeCompanyId ?? "");

  // Shared departments (no company) are always selectable.
  const availableDepartments = departments.filter((d) => !d.companyId || d.companyId === companyId);

  const openModal = () => {
    setCompanyId(activeCompanyId ?? "");
    setError(null);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const result = await createEmployee(formData);
      if (result.ok) setIsOpen(false);
      else setError(result.error);
    } catch {
      setError("Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-haspopup="dialog"
        className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors duration-200"
      >
        <UserPlus className="w-4 h-4" aria-hidden /> Add Employee
      </button>

      <Modal
        open={isOpen}
        onClose={() => setIsOpen(false)}
        size="lg"
        title="Add New Employee"
        description="A login is created with the work email and the default password Welcome123!"
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First name" required>
              <input name="firstName" autoComplete="off" className={controlClass} />
            </FormField>
            <FormField label="Last name" required>
              <input name="lastName" autoComplete="off" className={controlClass} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Work email" required>
              <input name="email" type="email" autoComplete="off" className={controlClass} />
            </FormField>
            <FormField label="Employee code" required hint="Unique, e.g. TB-002">
              <input name="employeeCode" autoComplete="off" className={`${controlClass} font-mono`} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Company / sister concern">
              <select name="companyId" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={controlClass}>
                <option value="">Unassigned</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Biometric / device ID" hint="Must match the ID on the punch device">
              <input name="biometricId" autoComplete="off" placeholder="Optional, e.g. 10245" className={`${controlClass} font-mono`} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Department">
              {/* key resets the choice when the company (and so the department list) changes */}
              <select key={companyId} name="departmentId" className={controlClass}>
                <option value="">Select department</option>
                {availableDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.companyId ? "" : " (Shared)"}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Designation">
              <select name="designationId" className={controlClass}>
                <option value="">Select designation</option>
                {designations.map((des) => (
                  <option key={des.id} value={des.id}>
                    {des.title}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Phone number">
              <input name="phone" type="tel" autoComplete="off" className={controlClass} />
            </FormField>
            <FormField label="Employment type">
              <select name="employmentType" className={controlClass}>
                <option value="FULL_TIME">Full time</option>
                <option value="PART_TIME">Part time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
              </select>
            </FormField>
          </div>

          {error && (
            <p role="alert" className="px-3 py-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-800 font-medium">
              {error}
            </p>
          )}

          <ModalActions>
            <button type="button" onClick={() => setIsOpen(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className={primaryButtonClass}>
              {loading ? "Saving…" : "Create Employee"}
            </button>
          </ModalActions>
        </form>
      </Modal>
    </>
  );
}

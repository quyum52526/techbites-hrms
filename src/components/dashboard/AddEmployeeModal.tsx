"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { createEmployee } from "@/app/actions/employees";

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
        onClick={openModal}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm"
      >
        <UserPlus className="w-4 h-4" /> Add Employee
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-sm">Add New Employee</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">First Name *</label>
                  <input name="firstName" required className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Last Name *</label>
                  <input name="lastName" required className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Work Email *</label>
                  <input name="email" type="email" required className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Employee Code *</label>
                  <input name="employeeCode" placeholder="TB-002" required className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Company / Sister Concern</label>
                  <select
                    name="companyId"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="">Unassigned</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Biometric / Device ID</label>
                  <input name="biometricId" placeholder="Optional, e.g. 10245" className="w-full border border-slate-200 rounded-lg p-2 font-mono focus:ring-1 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Department</label>
                  <select key={companyId} name="departmentId" className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none bg-white">
                    <option value="">Select Department</option>
                    {availableDepartments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}{d.companyId ? "" : " (Shared)"}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Designation</label>
                  <select name="designationId" className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none bg-white">
                    <option value="">Select Designation</option>
                    {designations.map((des) => (
                      <option key={des.id} value={des.id}>{des.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Phone Number</label>
                  <input name="phone" className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Employment Type</label>
                  <select name="employmentType" className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none bg-white">
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </div>
              </div>

              {error && <p className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-100">{error}</p>}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg font-semibold"
                >
                  {loading ? "Saving..." : "Create Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

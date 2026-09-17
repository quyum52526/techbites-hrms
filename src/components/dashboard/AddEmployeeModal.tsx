"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { createEmployee } from "@/app/actions/employees";

interface Props {
  departments: { id: string; name: string }[];
  designations: { id: string; title: string }[];
}

export default function AddEmployeeModal({ departments, designations }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await createEmployee(formData);
      setIsOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to create employee");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
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
                  <label className="block text-slate-600 font-medium mb-1">Department</label>
                  <select name="departmentId" className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none bg-white">
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
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
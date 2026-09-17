"use client";

import { useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { submitLeaveRequest } from "@/app/actions/leaves";

interface Props {
  employees: { id: string; firstName: string; lastName: string }[];
  leaveTypes: { id: string; name: string; daysAllowed: number }[];
}

export default function ApplyLeaveModal({ employees, leaveTypes }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    try {
      await submitLeaveRequest(formData);
      setIsOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to submit leave request");
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
        <CalendarPlus className="w-4 h-4" /> Apply for Leave
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 text-sm">Submit Leave Request</h3>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Select Employee *</label>
                <select name="employeeId" required className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none bg-white">
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Leave Type *</label>
                <select name="leaveTypeId" required className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none bg-white">
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.daysAllowed} days/yr)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Start Date *</label>
                  <input type="date" name="startDate" required className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">End Date *</label>
                  <input type="date" name="endDate" required className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Reason for Leave *</label>
                <textarea
                  name="reason"
                  required
                  rows={3}
                  placeholder="State the reason..."
                  className="w-full border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
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
                  {loading ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
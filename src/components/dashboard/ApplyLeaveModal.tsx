"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { submitLeaveRequest } from "@/app/actions/leaves";
import Modal, { ModalActions } from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import { controlClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/styles";
import { GuestLockedButton, useReadOnly } from "@/components/ui/ReadOnly";

const triggerClass =
  "flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors duration-200";

interface Props {
  employees: { id: string; firstName: string; lastName: string }[];
  leaveTypes: { id: string; name: string; daysAllowed: number }[];
}

export default function ApplyLeaveModal({ employees, leaveTypes }: Props) {
  const readOnly = useReadOnly();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");

  const openModal = () => {
    setError(null);
    setStartDate("");
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await submitLeaveRequest(formData);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit leave request");
    } finally {
      setLoading(false);
    }
  };

  if (readOnly) return <GuestLockedButton className={triggerClass}>Apply for Leave</GuestLockedButton>;

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-haspopup="dialog"
        className={triggerClass}
      >
        <CalendarPlus className="w-4 h-4" aria-hidden /> Apply for Leave
      </button>

      <Modal open={isOpen} onClose={() => setIsOpen(false)} title="Submit Leave Request" description="Requests go to HR for approval.">
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <FormField label="Employee" required>
            <select name="employeeId" className={controlClass}>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Leave type" required>
            <select name="leaveTypeId" className={controlClass}>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.daysAllowed} days/yr)
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Start date" required>
              <input type="date" name="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={controlClass} />
            </FormField>
            <FormField label="End date" required hint="Same as start for a single day">
              <input type="date" name="endDate" min={startDate || undefined} className={controlClass} />
            </FormField>
          </div>

          <FormField label="Reason for leave" required>
            <textarea name="reason" rows={3} placeholder="State the reason…" className={controlClass} />
          </FormField>

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
              {loading ? "Submitting…" : "Submit Application"}
            </button>
          </ModalActions>
        </form>
      </Modal>
    </>
  );
}

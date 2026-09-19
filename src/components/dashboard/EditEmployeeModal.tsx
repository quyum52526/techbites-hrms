"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { EmployeeStatus, EmploymentType, Role } from "@prisma/client";
import { updateEmployee } from "@/app/actions/employees";
import Modal, { ModalActions } from "@/components/ui/Modal";
import FormField from "@/components/ui/FormField";
import ImageUploadField from "@/components/ui/ImageUploadField";
import OrgUnitFields from "@/components/dashboard/OrgUnitFields";
import AccessFields from "@/components/dashboard/AccessFields";
import type { ManagerOption } from "@/lib/employee-edit";
import { controlClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/styles";
import { BLOOD_GROUPS, employeeStatusLabels, isSeparated, NID_SCAN_MAX_PX, PHOTO_MAX_PX } from "@/lib/employee-profile";

export type EditableEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  /** Login email; null when the employee has no user account. */
  email: string | null;
  /** Login role; null when the employee has no user account. */
  role: Role | null;
  managerId: string | null;
  currentManager: ManagerOption | null;
  employeeCode: string;
  biometricId: string | null;
  companyId: string | null;
  departmentId: string | null;
  designationId: string | null;
  phone: string | null;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  /** YYYY-MM-DD */
  joiningDate: string;
  gender: string | null;
  /** YYYY-MM-DD */
  dateOfBirth: string | null;
  nationalId: string | null;
  address: string | null;
  bloodGroup: string | null;
  photoUrl: string | null;
  nidScanUrl: string | null;
  referenceDetails: string | null;
};

interface Props {
  employee: EditableEmployee;
  companies: { id: string; name: string; code: string }[];
  departments: { id: string; name: string; companyId: string | null }[];
  designations: { id: string; title: string }[];
  managers: ManagerOption[];
  /** The signed-in admin: decides which roles can be granted, and locks their own role. */
  actor: { role: Role; employeeId: string | null };
  /** Where to go when the modal closes: the same page without the `?edit=` param that opened it. */
  closeHref: string;
}

const GENDERS = ["Male", "Female", "Other"];
const EDITABLE_STATUSES: EmployeeStatus[] = ["ACTIVE", "PROBATION", "NOTICE_PERIOD"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Edit form for every employee field, pre-filled. It is opened by a `?edit=<id>` URL param, so the directory
 * renders one modal for the selected row instead of one per row; closing it navigates back to `closeHref`.
 */
export default function EditEmployeeModal({ employee, companies, departments, designations, managers, actor, closeHref }: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(employee.companyId ?? "");

  const statusOptions = isSeparated(employee.status) ? [...EDITABLE_STATUSES, employee.status] : EDITABLE_STATUSES;
  const genderOptions = employee.gender && !GENDERS.includes(employee.gender) ? [...GENDERS, employee.gender] : GENDERS;

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await updateEmployee(employee.id, new FormData(e.currentTarget));
      if (result.ok) setIsOpen(false);
      else setError(result.error);
    } catch {
      setError("Failed to save changes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => router.replace(closeHref, { scroll: false })}
      size="2xl"
      title={`Edit ${employee.firstName} ${employee.lastName}`}
      description={`Employee code ${employee.employeeCode}`}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6 text-xs">
        <Section title="Identity & login">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First name" required>
              <input name="firstName" defaultValue={employee.firstName} autoComplete="off" className={controlClass} />
            </FormField>
            <FormField label="Last name" required>
              <input name="lastName" defaultValue={employee.lastName} autoComplete="off" className={controlClass} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Work email"
              required={employee.email !== null}
              hint={employee.email === null ? "This employee has no login account" : "Also changes their login email"}
            >
              <input
                name="email"
                type="email"
                defaultValue={employee.email ?? ""}
                disabled={employee.email === null}
                autoComplete="off"
                className={controlClass}
              />
            </FormField>
            <FormField label="Employee code" required>
              <input name="employeeCode" defaultValue={employee.employeeCode} autoComplete="off" className={`${controlClass} font-mono`} />
            </FormField>
          </div>
        </Section>

        <Section title="Access & reporting">
          <AccessFields
            actorRole={actor.role}
            currentRole={employee.role}
            isSelf={actor.employeeId === employee.id}
            managers={managers}
            defaultManagerId={employee.managerId}
            currentManager={employee.currentManager}
            employeeId={employee.id}
          />
        </Section>

        <Section title="Employment">
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
              <input name="biometricId" defaultValue={employee.biometricId ?? ""} autoComplete="off" className={`${controlClass} font-mono`} />
            </FormField>
          </div>
          <OrgUnitFields
            companyId={companyId}
            companies={companies}
            departments={departments}
            designations={designations}
            defaultDepartmentId={employee.departmentId}
            defaultDesignationId={employee.designationId}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Joining date" required>
              <input name="joiningDate" type="date" defaultValue={employee.joiningDate} className={controlClass} />
            </FormField>
            <FormField label="Employment type">
              <select name="employmentType" defaultValue={employee.employmentType} className={controlClass}>
                <option value="FULL_TIME">Full time</option>
                <option value="PART_TIME">Part time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
              </select>
            </FormField>
            <FormField label="Status" hint={isSeparated(employee.status) ? "Choose an active status to reinstate" : undefined}>
              <select name="status" defaultValue={employee.status} className={controlClass}>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {employeeStatusLabels[status]}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </Section>

        <Section title="Personal & contact">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Phone number">
              <input name="phone" type="tel" defaultValue={employee.phone ?? ""} autoComplete="off" className={controlClass} />
            </FormField>
            <FormField label="Gender">
              <select name="gender" defaultValue={employee.gender ?? ""} className={controlClass}>
                <option value="">Not set</option>
                {genderOptions.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Blood group">
              <select name="bloodGroup" defaultValue={employee.bloodGroup ?? ""} className={controlClass}>
                <option value="">Not set</option>
                {BLOOD_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Date of birth">
              <input name="dateOfBirth" type="date" defaultValue={employee.dateOfBirth ?? ""} className={controlClass} />
            </FormField>
            <FormField label="National ID (NID) number">
              <input name="nationalId" defaultValue={employee.nationalId ?? ""} autoComplete="off" className={`${controlClass} font-mono`} />
            </FormField>
          </div>
          <FormField label="Address">
            <textarea name="address" rows={2} defaultValue={employee.address ?? ""} className={controlClass} />
          </FormField>
        </Section>

        <Section title="Documents & references">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageUploadField name="photo" label="Photo" shape="circle" maxDimension={PHOTO_MAX_PX} currentUrl={employee.photoUrl} />
            <ImageUploadField
              name="nidScan"
              label="NID scan"
              hint="Front of the National ID card; JPEG, PNG or WebP"
              maxDimension={NID_SCAN_MAX_PX}
              currentUrl={employee.nidScanUrl}
            />
          </div>
          <FormField label="References" hint="Referee name, relation and phone; one per line">
            <textarea name="referenceDetails" rows={3} defaultValue={employee.referenceDetails ?? ""} className={controlClass} />
          </FormField>
        </Section>

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
            {loading ? "Saving…" : "Save Changes"}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}

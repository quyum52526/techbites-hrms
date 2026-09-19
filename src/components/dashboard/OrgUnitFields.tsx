"use client";

import { useState } from "react";
import { createDepartmentAction, createDesignationAction } from "@/app/actions/departments";
import SelectWithQuickCreate from "@/components/ui/SelectWithQuickCreate";

type Department = { id: string; name: string; companyId: string | null };
type Designation = { id: string; title: string };

interface Props {
  /** Company currently chosen in the form; filters departments and owns any department created here. */
  companyId: string;
  companies: { id: string; code: string }[];
  departments: Department[];
  designations: Designation[];
  defaultDepartmentId?: string | null;
  defaultDesignationId?: string | null;
}

const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);

/** Keeps server-provided rows first and adds rows created here that the server list does not have yet. */
function withCreated<T extends { id: string }>(fromServer: T[], created: T[]) {
  const known = new Set(fromServer.map((row) => row.id));
  return [...fromServer, ...created.filter((row) => !known.has(row.id))];
}

/**
 * Department + Designation selects for the employee forms, each with an inline "+ New". Created rows live in local
 * state, so the dropdowns update and select them without a reload and without touching any other field in the form.
 */
export default function OrgUnitFields({
  companyId,
  companies,
  departments,
  designations,
  defaultDepartmentId,
  defaultDesignationId,
}: Props) {
  const [createdDepartments, setCreatedDepartments] = useState<Department[]>([]);
  const [createdDesignations, setCreatedDesignations] = useState<Designation[]>([]);
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId ?? "");
  const [designationId, setDesignationId] = useState(defaultDesignationId ?? "");

  // Shared departments (no company) are always selectable.
  const availableDepartments = withCreated(departments, createdDepartments).filter((d) => !d.companyId || d.companyId === companyId);
  // A department from another company is dropped from the selection when the company changes.
  const selectedDepartmentId = availableDepartments.some((d) => d.id === departmentId) ? departmentId : "";
  const companyCode = companies.find((c) => c.id === companyId)?.code;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SelectWithQuickCreate
        label="Department"
        name="departmentId"
        noun="department"
        placeholder="Select department"
        value={selectedDepartmentId}
        onChange={setDepartmentId}
        options={availableDepartments
          .map((d) => ({ value: d.id, label: d.companyId ? d.name : `${d.name} (Shared)` }))
          .sort(byLabel)}
        createHint={companyCode ? `Created under ${companyCode}` : "No company selected, so it is created as a shared department"}
        onCreate={async (name) => {
          const result = await createDepartmentAction({ name, companyId: companyId || null });
          if (!result.ok) return result;
          setCreatedDepartments((rows) => [...rows, result.record]);
          return { ok: true, option: { value: result.record.id, label: result.record.name } };
        }}
      />
      <SelectWithQuickCreate
        label="Designation"
        name="designationId"
        noun="designation"
        placeholder="Select designation"
        value={designationId}
        onChange={setDesignationId}
        options={withCreated(designations, createdDesignations)
          .map((d) => ({ value: d.id, label: d.title }))
          .sort(byLabel)}
        createHint="Designations are shared by all departments and companies"
        onCreate={async (name) => {
          const result = await createDesignationAction({ name });
          if (!result.ok) return result;
          setCreatedDesignations((rows) => [...rows, result.record]);
          return { ok: true, option: { value: result.record.id, label: result.record.title } };
        }}
      />
    </div>
  );
}

"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { setSalaryStructure } from "@/app/actions/payroll";
import FormField from "@/components/ui/FormField";
import { ActionFeedback, SubmitButton } from "@/components/ui/FormFeedback";
import { controlClass } from "@/components/ui/styles";

const salaryFields = [
  { name: "basicSalary", label: "Basic salary", placeholder: "e.g. 30000", required: true },
  { name: "houseRent", label: "House rent", placeholder: "e.g. 15000" },
  { name: "medicalAllow", label: "Medical allowance", placeholder: "e.g. 2500" },
  { name: "otherAllow", label: "Other allowances", placeholder: "e.g. 1500" },
  { name: "taxDeduction", label: "Income tax", placeholder: "e.g. 1000" },
  { name: "providentFund", label: "Provident fund", placeholder: "e.g. 3000" },
];

interface EmployeeOption {
  id: string;
  name: string;
  employeeCode: string;
}

export default function SalaryStructureForm({ employees }: { employees: EmployeeOption[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(setSalaryStructure, null);

  // Clear the form only after a successful save; on an error the entered figures stay for correction.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      // Dispatched from onSubmit rather than `action=` because React resets `action=` forms even when the save fails.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      autoComplete="off"
      aria-busy={isPending}
      className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs"
    >
      <FormField label="Employee" required hint="Saving replaces this employee's current structure." className="col-span-2">
        {/* Nothing preselected, so a save can't silently overwrite the first employee in the list. */}
        <select name="employeeId" defaultValue="" className={controlClass}>
          <option value="" disabled>
            Select employee…
          </option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.employeeCode})
            </option>
          ))}
        </select>
      </FormField>
      {salaryFields.map((field) => (
        <FormField key={field.name} label={field.label} required={field.required}>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            name={field.name}
            placeholder={field.placeholder}
            autoComplete="off"
            className={`${controlClass} tabular-nums`}
          />
        </FormField>
      ))}
      <div className="col-span-2 sm:col-span-4 flex flex-wrap items-center justify-end gap-3">
        <ActionFeedback state={state} />
        <SubmitButton pending={isPending}>Save Structure</SubmitButton>
      </div>
    </form>
  );
}

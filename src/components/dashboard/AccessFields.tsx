"use client";

import { useId, useState } from "react";
import type { Role } from "@prisma/client";
import { Search } from "lucide-react";
import FormField from "@/components/ui/FormField";
import { controlClass } from "@/components/ui/styles";
import { assignableRoles, roleDescriptions, roleLabels, ROLE_OPTIONS } from "@/lib/auth-shared";
import type { ManagerOption } from "@/lib/employee-edit";

interface Props {
  /** Role of the admin filling in the form; decides which roles can be granted. */
  actorRole: Role;
  /** Current login role; undefined for a new employee (starts as Employee), null when the employee has no login. */
  currentRole?: Role | null;
  /** True when the admin is editing their own record: nobody changes their own role. */
  isSelf?: boolean;
  managers: ManagerOption[];
  defaultManagerId?: string | null;
  /** The saved manager, kept selectable even if they have since left the workforce list. */
  currentManager?: ManagerOption | null;
  /** The employee being edited, who cannot report to themselves. */
  employeeId?: string;
}

/** "System role" and "Reports to" for the employee forms. The server re-checks both. */
export default function AccessFields({
  actorRole,
  currentRole,
  isSelf = false,
  managers,
  defaultManagerId,
  currentManager,
  employeeId,
}: Props) {
  const searchId = useId();
  const [role, setRole] = useState<Role>(currentRole ?? "EMPLOYEE");
  const [managerId, setManagerId] = useState(defaultManagerId ?? "");
  const [query, setQuery] = useState("");

  const grantable = assignableRoles(actorRole);
  const roleLockedReason =
    currentRole === null
      ? "This employee has no login account"
      : isSelf
        ? "You cannot change your own role"
        : !grantable.includes(currentRole ?? "EMPLOYEE")
          ? `Only a Super Admin can change a ${roleLabels[currentRole!]} account`
          : null;
  // A locked role shows its current value only; otherwise the grantable roles, in access order.
  const roleOptions = roleLockedReason ? [currentRole ?? "EMPLOYEE"] : ROLE_OPTIONS.filter((r) => grantable.includes(r));

  const managerOptions = [
    ...(currentManager && !managers.some((m) => m.id === currentManager.id) ? [currentManager] : []),
    ...managers,
  ].filter((m) => m.id !== employeeId);
  const needle = query.trim().toLowerCase();
  // The selected manager always stays in the list, so filtering never silently changes the value.
  const visibleManagers = needle
    ? managerOptions.filter((m) => m.id === managerId || m.label.toLowerCase().includes(needle))
    : managerOptions;
  const matchCount = visibleManagers.filter((m) => m.label.toLowerCase().includes(needle)).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField label="System role" hint={roleLockedReason ?? roleDescriptions[role]}>
        {/* A disabled select is not submitted, so the server keeps the current role. */}
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          disabled={roleLockedReason !== null}
          className={controlClass}
        >
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {roleLabels[r]}
            </option>
          ))}
        </select>
      </FormField>

      <div className="space-y-1">
        <FormField label="Reports to / manager" hint={needle ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : "Their team leader or manager"}>
          <select name="managerId" value={managerId} onChange={(e) => setManagerId(e.target.value)} className={controlClass}>
            <option value="">No manager</option>
            {visibleManagers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </FormField>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" aria-hidden />
          <label htmlFor={searchId} className="sr-only">
            Filter managers by name or code
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Enter would submit the employee form.
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="Filter by name or code"
            autoComplete="off"
            className={`${controlClass} py-1.5 pl-7 text-[11px]`}
          />
        </div>
      </div>
    </div>
  );
}

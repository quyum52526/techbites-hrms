import { prisma } from "@/lib/prisma";
import AddEmployeeModal from "@/components/dashboard/AddEmployeeModal";
import CsvImportModal from "@/components/dashboard/CsvImportModal";
import EditEmployeeModal from "@/components/dashboard/EditEmployeeModal";
import EmployeeAvatar from "@/components/dashboard/EmployeeAvatar";
import { importEmployeesCsv } from "@/app/actions/employees";
import { Eye, Mail, Pencil, Phone } from "lucide-react";
import Link from "next/link";
import { requireHRView } from "@/lib/auth";
import { GuestLockedButton } from "@/components/ui/ReadOnly";
import { getAccessibleCompanyIds, getActiveCompanyId, employeeScope } from "@/lib/company";
import { employeeSearchWhere } from "@/lib/employee-search";
import { loadEditableEmployee, loadEmployeeFormOptions } from "@/lib/employee-edit";
import { employeeStatusBadgeClass, employeeStatusLabels } from "@/lib/employee-profile";

const rowActionClass =
  "inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors duration-150";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; edit?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const user = await requireHRView();
  const guest = user.role === "GUEST";
  const activeCompanyId = await getActiveCompanyId();

  // Search is kept in every row link, so opening and closing the edit modal returns to the same results.
  const listHref = query ? `/dashboard/employees?q=${encodeURIComponent(query)}` : "/dashboard/employees";
  const editHref = (id: string) => `${listHref}${query ? "&" : "?"}edit=${encodeURIComponent(id)}`;

  const [employees, { companies, departments, designations, managers }, editing] = await Promise.all([
    prisma.employee.findMany({
      where: { ...employeeScope(activeCompanyId), ...(query ? employeeSearchWhere(query) : {}) },
      include: {
        company: { select: { code: true, name: true } },
        department: true,
        designation: true,
        user: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    loadEmployeeFormOptions(),
    params.edit && !guest ? loadEditableEmployee(params.edit) : null,
  ]);
  const accessibleCompanyIds = await getAccessibleCompanyIds(user);
  const safeEditing = editing && (!accessibleCompanyIds || (editing.companyId && accessibleCompanyIds.includes(editing.companyId))) ? editing : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Employee Directory</h1>
          <p className="text-xs text-slate-600">
            {query ? (
              <>
                {employees.length} result{employees.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo; ·{" "}
                <Link href="/dashboard/employees" className="font-medium text-brand-700 hover:underline">
                  Clear search
                </Link>
              </>
            ) : guest ? (
              "Browse workforce records, departments, and designations"
            ) : (
              "Manage workforce records, departments, and designations"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvImportModal
            buttonLabel="Bulk Import CSV"
            title="Bulk Import Employees"
            description="Every row is checked before anything is saved. If any row has a problem, no employees are imported and each issue is listed by line number. Imported accounts get the default password Welcome123!"
            columns={[
              { name: "firstName", required: true },
              { name: "lastName", required: true },
              { name: "email", required: true },
              { name: "employeeCode", required: true },
              { name: "companyCode", hint: "an existing company's short code; blank uses the company selected in the top bar" },
              { name: "department", hint: "existing department name (the company's own or a shared one)" },
              { name: "designation", hint: "existing designation title" },
              { name: "phone" },
              { name: "biometricId", hint: "device ID used to match punch logs; must be unique" },
            ]}
            templateHref="/templates/employee-import-template.csv"
            action={importEmployeesCsv}
          />
          {user.role === "GUEST" ? (
            <GuestLockedButton className="bg-brand-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm">Add Employee</GuestLockedButton>
          ) : (
            <AddEmployeeModal
              companies={companies}
              departments={departments}
              designations={designations}
              managers={managers}
              actorRole={user.role}
              activeCompanyId={activeCompanyId}
            />
          )}
        </div>
      </div>

      {/* Employees Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Emp Code</th>
                <th className="py-3 px-4">Role & Dept</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar firstName={emp.firstName} lastName={emp.lastName} photoUrl={emp.photoUrl} />
                      <div>
                        <Link href={`/dashboard/employees/${emp.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                          {emp.firstName} {emp.lastName}
                        </Link>
                        <p className="text-[11px] text-slate-500">{emp.user?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono font-medium text-slate-600">{emp.employeeCode}</p>
                    {emp.company && (
                      <span title={emp.company.name} className="inline-block mt-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
                        {emp.company.code}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-800">{emp.designation?.title ?? "No Designation"}</p>
                    <p className="text-[11px] text-slate-500">{emp.department?.name ?? "General"}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-500" /> {emp.user?.email}</span>
                      {emp.phone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-500" /> {emp.phone}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {emp.employmentType}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${employeeStatusBadgeClass[emp.status]}`}>
                      {employeeStatusLabels[emp.status]}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`/dashboard/employees/${emp.id}`}
                        aria-label={`View profile of ${emp.firstName} ${emp.lastName}`}
                        className={rowActionClass}
                      >
                        <Eye className="w-3.5 h-3.5" aria-hidden /> View
                      </Link>
                      {guest ? (
                        <GuestLockedButton className={rowActionClass}>Edit</GuestLockedButton>
                      ) : (
                        <Link
                          href={editHref(emp.id)}
                          scroll={false}
                          aria-label={`Edit profile of ${emp.firstName} ${emp.lastName}`}
                          className={rowActionClass}
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden /> Edit
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {safeEditing && user.role !== "GUEST" && (
        <EditEmployeeModal
          key={safeEditing.id}
          employee={safeEditing}
          companies={companies}
          departments={departments}
          designations={designations}
          managers={managers}
          actor={{ role: user.role, employeeId: user.employeeId }}
          closeHref={listHref}
        />
      )}
    </div>
  );
}
import { prisma } from "@/lib/prisma";
import AddEmployeeModal from "@/components/dashboard/AddEmployeeModal";
import CsvImportModal from "@/components/dashboard/CsvImportModal";
import { importEmployeesCsv } from "@/app/actions/employees";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import { getActiveCompanyId, employeeScope } from "@/lib/company";

export default async function EmployeesPage() {
  const activeCompanyId = await getActiveCompanyId();

  const [employees, companies, departments, designations] = await Promise.all([
    prisma.employee.findMany({
      where: employeeScope(activeCompanyId),
      include: {
        company: { select: { code: true, name: true } },
        department: true,
        designation: true,
        user: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.company.findMany({
      select: { id: true, name: true, code: true },
      orderBy: [{ isParent: "desc" }, { name: "asc" }],
    }),
    prisma.department.findMany({ select: { id: true, name: true, companyId: true }, orderBy: { name: "asc" } }),
    prisma.designation.findMany({ select: { id: true, title: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Employee Directory</h2>
          <p className="text-xs text-slate-500">Manage workforce records, departments, and designations</p>
        </div>
        <div className="flex items-center gap-2">
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
          <AddEmployeeModal
            companies={companies}
            departments={departments}
            designations={designations}
            activeCompanyId={activeCompanyId}
          />
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-xs">
                        {emp.firstName[0]}{emp.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{emp.firstName} {emp.lastName}</p>
                        <p className="text-[11px] text-slate-400">{emp.user?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-mono font-medium text-slate-600">{emp.employeeCode}</p>
                    {emp.company && (
                      <span title={emp.company.name} className="inline-block mt-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">
                        {emp.company.code}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-slate-800">{emp.designation?.title ?? "No Designation"}</p>
                    <p className="text-[11px] text-slate-400">{emp.department?.name ?? "General"}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-400" /> {emp.user?.email}</span>
                      {emp.phone && <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-400" /> {emp.phone}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {emp.employmentType}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600">
                      {emp.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
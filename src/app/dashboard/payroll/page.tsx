import { prisma } from "@/lib/prisma";
import { setSalaryStructure, generatePayslip } from "@/app/actions/payroll";
import { Banknote, DollarSign, Receipt, CreditCard, Sparkles } from "lucide-react";

export default async function PayrollPage() {
  const currentMonth = "September 2026";

  const [employees, payrollRecords] = await Promise.all([
    prisma.employee.findMany({
      include: {
        salaryStructure: true,
        department: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payrollRecord.findMany({
      where: { month: currentMonth },
      include: { employee: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalPayrollLiability = payrollRecords.reduce((acc, curr) => acc + curr.netSalary, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Payroll Management</h2>
          <p className="text-xs text-slate-500">Manage salary structures, deductions, and generate payslips</p>
        </div>
        <div className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" /> Billing Period: {currentMonth}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Current Liability</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">${totalPayrollLiability.toLocaleString()}</p>
          </div>
          <div className="p-3 rounded-xl text-indigo-600 bg-indigo-50">
            <Banknote className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Payslips Generated</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{payrollRecords.length}</p>
          </div>
          <div className="p-3 rounded-xl text-emerald-600 bg-emerald-50">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Configured Employees</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {employees.filter((e) => e.salaryStructure).length} / {employees.length}
            </p>
          </div>
          <div className="p-3 rounded-xl text-blue-600 bg-blue-50">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800">Workforce Compensation & Payslip Generation</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Base Salary</th>
                <th className="py-3 px-4">Allowances</th>
                <th className="py-3 px-4">Deductions</th>
                <th className="py-3 px-4">Net Payable</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => {
                const s = emp.salaryStructure;
                const allowances = s ? s.houseRent + s.medicalAllow + s.otherAllow : 0;
                const deductions = s ? s.taxDeduction : 0;
                const net = s ? s.basicSalary + allowances - deductions : 0;
                const hasGenerated = payrollRecords.some((r) => r.employeeId === emp.id);

                return (
                  <tr key={emp.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{emp.firstName} {emp.lastName}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{emp.employeeCode}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{emp.department?.name ?? "N/A"}</td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {s ? `$${s.basicSalary.toLocaleString()}` : <span className="text-slate-400">Unset</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-600">
                      {s ? `+$${allowances.toLocaleString()}` : "$0"}
                    </td>
                    <td className="py-3 px-4 font-mono text-rose-500">
                      {s ? `-$${deductions.toLocaleString()}` : "$0"}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {s ? `$${net.toLocaleString()}` : "$0"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {s ? (
                        <form action={async () => {
                          "use server";
                          await generatePayslip(emp.id, currentMonth);
                        }}>
                          <button
                            type="submit"
                            disabled={hasGenerated}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm ${
                              hasGenerated
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            }`}
                          >
                            {hasGenerated ? "Generated" : "Generate Slip"}
                          </button>
                        </form>
                      ) : (
                        <span className="text-[11px] text-amber-600 font-medium">Configure salary first</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-indigo-600" /> Set Employee Salary Structure
        </h3>
        <form action={setSalaryStructure} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Employee</label>
            <select name="employeeId" required className="w-full border border-slate-200 rounded-lg p-2 outline-none bg-white">
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">Basic Salary ($)</label>
            <input type="number" step="any" name="basicSalary" placeholder="e.g. 5000" required className="w-full border border-slate-200 rounded-lg p-2 outline-none" />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">House Rent ($)</label>
            <input type="number" step="any" name="houseRent" placeholder="e.g. 1000" className="w-full border border-slate-200 rounded-lg p-2 outline-none" />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">Medical Allowance ($)</label>
            <input type="number" step="any" name="medicalAllow" placeholder="e.g. 300" className="w-full border border-slate-200 rounded-lg p-2 outline-none" />
          </div>
          <div className="flex flex-col justify-end">
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg">
              Save Structure
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
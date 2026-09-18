import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { setSalaryStructure } from "@/app/actions/payroll";
import { Banknote, CheckCircle2, Clock3, DollarSign, Users } from "lucide-react";
import { getActiveUser } from "@/lib/auth";
import { getActiveCompanyId, employeeScope } from "@/lib/company";
import { orgToday } from "@/lib/attendance-time";
import { formatMoney, parsePeriodParam, periodLabel as toPeriodLabel } from "@/lib/payroll";
import CompanyLogo from "@/components/dashboard/CompanyLogo";
import PayslipModal, { type PayslipData } from "@/components/dashboard/PayslipModal";
import { PayrollControls, PayrollStatusSelect } from "@/components/dashboard/PayrollControls";

const inputClass =
  "w-full border border-slate-300 rounded-lg p-2 text-slate-900 bg-white font-medium placeholder:text-slate-500 placeholder:font-normal focus:ring-2 focus:ring-brand-600 outline-none";
const labelClass = "block text-slate-700 font-semibold mb-1";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const today = orgToday();
  const period = parsePeriodParam((await searchParams).period) ?? { month: today.getUTCMonth() + 1, year: today.getUTCFullYear() };
  const label = toPeriodLabel(period);

  const [user, activeCompanyId] = await Promise.all([getActiveUser(), getActiveCompanyId()]);
  const canManage = user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN";

  // Admins see the selected company (or everyone); other roles only ever see their own pay-slips.
  const recordWhere: Prisma.PayrollRecordWhereInput = !canManage
    ? { month: label, employeeId: user.employeeId ?? "__none__" }
    : activeCompanyId
      ? // Pay-slips generated before companies existed have no companyId, so fall back to the employee's company.
        { month: label, OR: [{ companyId: activeCompanyId }, { companyId: null, employee: { companyId: activeCompanyId } }] }
      : { month: label };

  const [payrollRecords, employees, activeCompany] = await Promise.all([
    prisma.payrollRecord.findMany({
      where: recordWhere,
      include: {
        company: true,
        employee: { include: { company: true, department: true, designation: true } },
      },
      orderBy: [{ employee: { firstName: "asc" } }, { employee: { lastName: "asc" } }],
    }),
    canManage
      ? prisma.employee.findMany({
          where: employeeScope(activeCompanyId),
          include: { salaryStructure: true },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        })
      : Promise.resolve([]),
    activeCompanyId ? prisma.company.findUnique({ where: { id: activeCompanyId }, select: { name: true } }) : null,
  ]);

  const paidRecords = payrollRecords.filter((r) => r.status === "PAID");
  const pendingRecords = payrollRecords.filter((r) => r.status !== "PAID");
  const sum = (records: typeof payrollRecords) => records.reduce((acc, r) => acc + r.netSalary, 0);
  const configuredCount = employees.filter((e) => e.salaryStructure).length;

  const cards = [
    { label: `Total Payroll · ${label}`, value: formatMoney(sum(payrollRecords)), sub: `${payrollRecords.length} pay-slip(s)`, icon: Banknote, color: "text-brand-700 bg-brand-50" },
    { label: "Disbursed (Paid)", value: formatMoney(sum(paidRecords)), sub: `${paidRecords.length} paid`, icon: CheckCircle2, color: "text-emerald-700 bg-emerald-50" },
    { label: "Pending Disbursement", value: formatMoney(sum(pendingRecords)), sub: `${pendingRecords.length} not yet paid`, icon: Clock3, color: "text-amber-700 bg-amber-50" },
    ...(canManage
      ? [{ label: "Salary Configured", value: `${configuredCount} / ${employees.length}`, sub: "employees in scope", icon: Users, color: "text-brand-700 bg-brand-50" }]
      : []),
  ];

  const toPayslip = (record: (typeof payrollRecords)[number]): PayslipData => {
    const company = record.company ?? record.employee.company;
    return {
      recordId: record.id,
      periodLabel: record.month,
      status: record.status,
      paymentDate: record.paymentDate?.toISOString() ?? null,
      generatedAt: record.updatedAt.toISOString(),
      company: company
        ? { name: company.name, logoUrl: company.logoUrl, address: company.address, binNumber: company.binNumber, phone: company.phone, email: company.email }
        : null,
      employee: {
        name: `${record.employee.firstName} ${record.employee.lastName}`,
        employeeCode: record.employee.employeeCode,
        biometricId: record.employee.biometricId,
        designation: record.employee.designation?.title ?? null,
        department: record.employee.department?.name ?? null,
      },
      basicSalary: record.basicSalary,
      houseRent: record.houseRent,
      medicalAllow: record.medicalAllow,
      allowances: record.allowances,
      taxDeduction: record.taxDeduction,
      providentFund: record.providentFund,
      attendanceDeduction: record.attendanceDeduction,
      lateDays: record.lateDays,
      absentDays: record.absentDays,
      deductions: record.deductions,
      netSalary: record.netSalary,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Payroll Management</h2>
          <p className="text-xs text-slate-600">
            {canManage
              ? `Generate monthly payroll, track disbursement and issue branded pay-slips · ${activeCompany?.name ?? "All Companies"}`
              : "Your monthly pay-slips"}
          </p>
        </div>
        {canManage && (
          <PayrollControls
            period={period}
            periodLabel={label}
            activeCompanyId={activeCompanyId}
            scopeLabel={activeCompany?.name ?? "all companies"}
            hasRecords={payrollRecords.length > 0}
          />
        )}
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${canManage ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-600 truncate">{card.label}</p>
                <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{card.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{card.sub}</p>
              </div>
              <div className={`p-3 rounded-xl shrink-0 ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Payroll records for the period */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Payroll Register · {label}</h3>
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">{payrollRecords.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Employee</th>
                <th className="py-3 px-4 font-semibold">Company</th>
                <th className="py-3 px-4 font-semibold text-right">Gross</th>
                <th className="py-3 px-4 font-semibold text-right">Deductions</th>
                <th className="py-3 px-4 font-semibold text-right">Net Pay</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Pay-slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payrollRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-600">
                    {canManage
                      ? `No payroll generated for ${label} yet. Use "Generate Payroll" above.`
                      : `No pay-slip issued for ${label}.`}
                  </td>
                </tr>
              ) : (
                payrollRecords.map((record) => {
                  const company = record.company ?? record.employee.company;
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">
                          {record.employee.firstName} {record.employee.lastName}
                        </p>
                        <p className="text-[11px] text-slate-600 font-mono">
                          {record.employee.employeeCode}
                          {record.employee.department ? ` · ${record.employee.department.name}` : ""}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        {company ? (
                          <div className="flex items-center gap-2">
                            <CompanyLogo name={company.name} logoUrl={company.logoUrl} className="w-6 h-6" />
                            <span className="font-mono text-[11px] font-semibold text-slate-800">{company.code}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                        {formatMoney(record.basicSalary + record.allowances)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-red-700">
                        {record.deductions > 0 ? `−${formatMoney(record.deductions)}` : formatMoney(0)}
                        {(record.lateDays > 0 || record.absentDays > 0) && (
                          <p className="text-[11px] text-slate-600 font-sans">
                            {record.absentDays} absent · {record.lateDays} late
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">{formatMoney(record.netSalary)}</td>
                      <td className="py-3 px-4">
                        {canManage ? (
                          <PayrollStatusSelect recordId={record.id} status={record.status} />
                        ) : (
                          <span className="text-[11px] font-bold text-slate-900">{record.status}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <PayslipModal payslip={toPayslip(record)} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canManage && (
        <>
          {/* Salary structures */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Salary Structures</h3>
              <p className="text-[11px] text-slate-600">Monthly figures used when payroll is generated. Late/absent fines are applied at generation time.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Employee</th>
                    <th className="py-3 px-4 font-semibold text-right">Basic</th>
                    <th className="py-3 px-4 font-semibold text-right">House Rent</th>
                    <th className="py-3 px-4 font-semibold text-right">Medical</th>
                    <th className="py-3 px-4 font-semibold text-right">Other</th>
                    <th className="py-3 px-4 font-semibold text-right">Tax</th>
                    <th className="py-3 px-4 font-semibold text-right">PF</th>
                    <th className="py-3 px-4 font-semibold text-right">Net (before fines)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => {
                    const s = emp.salaryStructure;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4">
                          <p className="font-semibold text-slate-900">{emp.firstName} {emp.lastName}</p>
                          <p className="text-[11px] text-slate-600 font-mono">{emp.employeeCode}</p>
                        </td>
                        {s ? (
                          <>
                            {[s.basicSalary, s.houseRent, s.medicalAllow, s.otherAllow, s.taxDeduction, s.providentFund].map((value, i) => (
                              <td key={i} className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">{formatMoney(value)}</td>
                            ))}
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                              {formatMoney(s.basicSalary + s.houseRent + s.medicalAllow + s.otherAllow - s.taxDeduction - s.providentFund)}
                            </td>
                          </>
                        ) : (
                          <td colSpan={7} className="py-2.5 px-4 text-right text-[11px] font-semibold text-amber-800">
                            Not configured — excluded from payroll
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-brand-600" /> Set Employee Salary Structure (monthly, ৳)
            </h3>
            <form action={setSalaryStructure} autoComplete="off" className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="col-span-2">
                <label className={labelClass}>Employee *</label>
                <select name="employeeId" required className={inputClass}>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName} ({e.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
              {[
                { name: "basicSalary", label: "Basic Salary *", placeholder: "e.g. 30000", required: true },
                { name: "houseRent", label: "House Rent", placeholder: "e.g. 15000" },
                { name: "medicalAllow", label: "Medical Allowance", placeholder: "e.g. 2500" },
                { name: "otherAllow", label: "Other Allowances", placeholder: "e.g. 1500" },
                { name: "taxDeduction", label: "Income Tax", placeholder: "e.g. 1000" },
                { name: "providentFund", label: "Provident Fund", placeholder: "e.g. 3000" },
              ].map((field) => (
                <div key={field.name}>
                  <label className={labelClass}>{field.label}</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    name={field.name}
                    placeholder={field.placeholder}
                    required={field.required}
                    autoComplete="off"
                    className={inputClass}
                  />
                </div>
              ))}
              <div className="col-span-2 sm:col-span-4 flex justify-end">
                <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-6 rounded-lg">
                  Save Structure
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

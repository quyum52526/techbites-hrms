import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, FileText, Pencil, ReceiptText } from "lucide-react";
import { clsx } from "clsx";
import { prisma } from "@/lib/prisma";
import { getActiveUser, isHRAdmin } from "@/lib/auth";
import { orgDateOf, orgToday } from "@/lib/attendance-time";
import { formatMoney } from "@/lib/payroll";
import { serviceLength } from "@/lib/settlement";
import { loadEditableEmployee, loadEmployeeFormOptions } from "@/lib/employee-edit";
import { employeeStatusBadgeClass, employeeStatusLabels, isSeparated, toDateInputValue } from "@/lib/employee-profile";
import EditEmployeeModal from "@/components/dashboard/EditEmployeeModal";
import EmployeeAvatar from "@/components/dashboard/EmployeeAvatar";
import ReleaseCalculator from "@/components/dashboard/ReleaseCalculator";
import { cardClass, secondaryButtonClass } from "@/components/ui/styles";
import { getAccessibleCompanyIds } from "@/lib/company";
import { getLeaveBalances } from "@/lib/leave-balance";
import { balanceStatus, balanceStatusBadgeClass, balanceStatusLabels } from "@/lib/leave-shared";
import LeaveHistoryModal from "@/components/dashboard/LeaveHistoryModal";

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });

const employmentTypeLabels = { FULL_TIME: "Full time", PART_TIME: "Part time", CONTRACT: "Contract", INTERN: "Intern" } as const;

/** Service from joining to release (or today), e.g. "3 yr 4 mo". */
function tenure(joining: Date, until: Date) {
  const { completedYears, remainingMonths } = serviceLength(orgDateOf(joining), orgDateOf(until));
  return completedYears > 0 ? `${completedYears} yr ${remainingMonths} mo` : `${remainingMonths} mo`;
}

function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx(cardClass, "p-5", className)}>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  );
}

function Details({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-slate-600">{label}</dt>
          <dd className="text-right font-medium text-slate-900 break-words">
            {value ?? <span className="font-normal text-slate-500">Not provided</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ id }, { edit }, user] = await Promise.all([params, searchParams, getActiveUser()]);
  const isAdmin = isHRAdmin(user.role);
  // HR admins see every profile; anyone else only their own, read-only.
  if (!isAdmin && user.employeeId !== id) notFound();

  const employee = await prisma.employee.findFirst({
    where: { id },
    include: {
      user: { select: { email: true } },
      company: { select: { name: true, code: true } },
      department: { select: { name: true } },
      designation: { select: { title: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      salaryStructure: { select: { basicSalary: true } },
      settlements: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!employee) notFound();
  const accessibleCompanyIds = await getAccessibleCompanyIds(user);
  if (accessibleCompanyIds && (!employee.companyId || !accessibleCompanyIds.includes(employee.companyId))) notFound();

  const settlement = employee.settlements[0] ?? null;
  const separated = isSeparated(employee.status);
  const profileHref = `/dashboard/employees/${employee.id}`;

  const [editing, formOptions, processedBy, leaveBalances] = await Promise.all([
    isAdmin && edit ? loadEditableEmployee(employee.id) : null,
    isAdmin && edit ? loadEmployeeFormOptions() : null,
    settlement?.processedById
      ? prisma.user.findUnique({ where: { id: settlement.processedById }, select: { email: true } })
      : null,
    getLeaveBalances({ id: employee.id }),
  ]);

  const fullName = `${employee.firstName} ${employee.lastName}`;
  const balances = leaveBalances.balancesFor(employee.id);
  const leaveStatus = balanceStatus(balances);
  const nidIsPdf = employee.nidScanUrl ? /\.pdf($|[?#])/i.test(employee.nidScanUrl) : false;

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Link href="/dashboard/employees" className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Employee Directory
        </Link>
      )}

      {/* Header */}
      <section className={clsx(cardClass, "p-5 flex flex-wrap items-center gap-5")}>
        <EmployeeAvatar
          firstName={employee.firstName}
          lastName={employee.lastName}
          photoUrl={employee.photoUrl}
          className="w-20 h-20 text-2xl"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{fullName}</h1>
            <span className={clsx("px-2 py-0.5 rounded-full text-[11px] font-semibold", employeeStatusBadgeClass[employee.status])}>
              {employeeStatusLabels[employee.status]}
            </span>
          </div>
          <p className="text-sm text-slate-700">
            {employee.designation?.title ?? "No designation"}
            <span className="text-slate-500"> · {employee.department?.name ?? "General"}</span>
          </p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-mono font-medium">{employee.employeeCode}</span>
            {employee.company && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3 h-3" aria-hidden /> {employee.company.name} ({employee.company.code})
              </span>
            )}
          </p>
        </div>
        {isAdmin && (
          <Link href={`${profileHref}?edit=1`} scroll={false} className={clsx(secondaryButtonClass, "inline-flex items-center gap-2 text-xs")}>
            <Pencil className="w-3.5 h-3.5" aria-hidden /> Edit Profile
          </Link>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title="Employment">
          <Details
            items={[
              ["Joining date", formatDate(employee.joiningDate)],
              ["Service length", tenure(employee.joiningDate, settlement?.releaseDate ?? new Date())],
              ["Designation", employee.designation?.title],
              ["Department", employee.department?.name],
              ["Employment type", employmentTypeLabels[employee.employmentType]],
              [
                "Reports to",
                employee.manager && (
                  <Link href={`/dashboard/employees/${employee.manager.id}`} className="text-brand-700 hover:underline">
                    {employee.manager.firstName} {employee.manager.lastName}
                  </Link>
                ),
              ],
              ["Biometric ID", employee.biometricId && <span className="font-mono">{employee.biometricId}</span>],
            ]}
          />
        </Panel>

        <Panel title="Contact">
          <Details
            items={[
              ["Work email", employee.user?.email && <a href={`mailto:${employee.user.email}`} className="text-brand-700 hover:underline">{employee.user.email}</a>],
              ["Phone", employee.phone && <a href={`tel:${employee.phone}`} className="text-brand-700 hover:underline">{employee.phone}</a>],
              ["Address", employee.address && <span className="whitespace-pre-line">{employee.address}</span>],
            ]}
          />
        </Panel>

        <Panel title="Personal">
          <Details
            items={[
              ["Gender", employee.gender],
              ["Date of birth", employee.dateOfBirth && formatDate(employee.dateOfBirth)],
              [
                "Blood group",
                employee.bloodGroup && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold">{employee.bloodGroup}</span>
                ),
              ],
              ["NID number", employee.nationalId && <span className="font-mono">{employee.nationalId}</span>],
            ]}
          />
        </Panel>
      </div>

      <section aria-labelledby="leave-balance-title" className={clsx(cardClass, "p-5")}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 id="leave-balance-title" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Leave balance · {leaveBalances.year}
            </h2>
            <span className={clsx("px-2 py-0.5 rounded-full text-[11px] font-semibold", balanceStatusBadgeClass[leaveStatus])}>
              {balanceStatusLabels[leaveStatus]}
            </span>
          </div>
          <LeaveHistoryModal employeeId={employee.id} employeeName={fullName} />
        </div>
        {balances.length === 0 ? (
          <p className="text-xs text-slate-500">No leave types are configured.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {balances.map((balance) => {
              const usedShare = balance.quota > 0 ? Math.min(balance.used / balance.quota, 1) : 0;
              return (
                <li key={balance.leaveTypeId} className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-slate-900">{balance.name}</span>
                    <span className="tabular-nums text-slate-600">
                      {balance.used} / {balance.quota} days used
                    </span>
                  </div>
                  <div
                    role="meter"
                    aria-label={`${balance.name} leave used`}
                    aria-valuemin={0}
                    aria-valuemax={balance.quota}
                    aria-valuenow={Math.min(balance.used, balance.quota)}
                    className="h-1.5 rounded-full bg-slate-100 overflow-hidden"
                  >
                    <div
                      className={clsx("h-full rounded-full", balance.remaining <= 0 ? "bg-rose-600" : usedShare >= 0.8 ? "bg-amber-500" : "bg-emerald-600")}
                      style={{ width: `${usedShare * 100}%` }}
                    />
                  </div>
                  <p className={clsx("font-semibold tabular-nums", balance.remaining <= 0 ? "text-rose-700" : "text-emerald-700")}>
                    {balance.remaining} {Math.abs(balance.remaining) === 1 ? "day" : "days"} remaining
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="NID scan">
          {!employee.nidScanUrl ? (
            <p className="text-xs text-slate-500">No NID scan on file{isAdmin ? " — add its URL with Edit Profile." : "."}</p>
          ) : nidIsPdf ? (
            <a
              href={employee.nidScanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-brand-700 hover:bg-slate-50"
            >
              <FileText className="w-4 h-4" aria-hidden /> Open NID scan (PDF) <ExternalLink className="w-3 h-3" aria-hidden />
            </a>
          ) : (
            <a href={employee.nidScanUrl} target="_blank" rel="noopener noreferrer" className="group block w-fit">
              {/* Plain <img>: scans can live on arbitrary hosts, which next/image would need whitelisted. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={employee.nidScanUrl}
                alt={`National ID card scan of ${fullName}`}
                className="max-h-56 rounded-lg border border-slate-200 bg-slate-50 object-contain"
              />
              <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 group-hover:underline">
                Open full size <ExternalLink className="w-3 h-3" aria-hidden />
              </span>
            </a>
          )}
        </Panel>

        <Panel title="References">
          {employee.referenceName || employee.referencePhone || employee.referenceRelation || employee.referenceDetails ? (
            <Details
              items={[
                ["Name", employee.referenceName],
                ["Contact number", employee.referencePhone && <a href={`tel:${employee.referencePhone}`} className="text-brand-700 hover:underline">{employee.referencePhone}</a>],
                ["Relationship / Details", employee.referenceRelation],
                ["Additional notes", employee.referenceDetails && <span className="whitespace-pre-line">{employee.referenceDetails}</span>],
              ]}
            />
          ) : (
            <p className="text-xs text-slate-500">No references recorded.</p>
          )}
        </Panel>
      </div>

      {/* Release: the stored settlement once processed, otherwise the calculator (admins, never on their own profile). */}
      {separated && settlement ? (
        <section aria-labelledby="settlement-title" className={clsx(cardClass, "p-5 space-y-4 text-xs")}>
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-9 h-9 rounded-lg bg-slate-100 text-slate-700 shrink-0">
              <ReceiptText className="w-4 h-4" aria-hidden />
            </span>
            <div>
              <h2 id="settlement-title" className="text-sm font-semibold text-slate-900">Final Settlement</h2>
              <p className="text-slate-600">
                {settlement.separationType === "TERMINATED" ? "Terminated by the company" : "Resigned"} on {formatDate(settlement.releaseDate)}
                {" · "}processed {formatDate(settlement.createdAt)}
                {processedBy && <> by {processedBy.email}</>}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Details
              items={[
                ["Joining date", formatDate(settlement.joiningDate)],
                ["Release date", formatDate(settlement.releaseDate)],
                ["Service", `${settlement.serviceDays.toLocaleString()} days`],
                ["Benefit basis", `${settlement.payableYears} yr × ${settlement.serviceBenefitDaysPerYear} days`],
                ["Basic salary", formatMoney(settlement.basicSalary)],
                ["Unused leave", `${settlement.unusedLeaveDays} days`],
                ["Unpaid salary days", `${settlement.unpaidSalaryDays} days`],
              ]}
            />
            <Details
              items={[
                ["Notice pay", settlement.noticePayApplied ? formatMoney(settlement.noticePay) : "Not applied"],
                ["Service benefit", settlement.serviceBenefitApplied ? formatMoney(settlement.serviceBenefit) : "Not applied"],
                ["Leave encashment", formatMoney(settlement.leaveEncashment)],
                ["Unpaid salary", formatMoney(settlement.unpaidSalary)],
                ["Deductions", <span key="deductions" className="text-rose-700">− {formatMoney(settlement.deductions)}</span>],
                ["Net settlement", <span key="net" className="text-sm font-bold text-brand-800">{formatMoney(settlement.netPayable)}</span>],
              ]}
            />
          </div>
        </section>
      ) : separated ? (
        <p className={clsx(cardClass, "p-5 text-xs text-slate-600")}>
          Marked {employeeStatusLabels[employee.status].toLowerCase()} without a settlement record.
        </p>
      ) : isAdmin && user.employeeId !== employee.id ? (
        <ReleaseCalculator
          employeeId={employee.id}
          employeeName={fullName}
          joiningDate={toDateInputValue(employee.joiningDate)}
          today={orgToday().toISOString().slice(0, 10)}
          initialBasicSalary={employee.salaryStructure?.basicSalary ?? null}
        />
      ) : null}

      {editing && formOptions && (
        <EditEmployeeModal
          key={editing.id}
          employee={editing}
          companies={formOptions.companies}
          departments={formOptions.departments}
          designations={formOptions.designations}
          managers={formOptions.managers}
          actor={{ role: user.role, employeeId: user.employeeId }}
          closeHref={profileHref}
        />
      )}
    </div>
  );
}

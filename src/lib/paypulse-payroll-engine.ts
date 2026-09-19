export type PayModel = "HOURLY" | "DAILY" | "QUANTITY" | "MONTHLY";

export interface PayPulseAttendanceAggregate {
  totalHours: number;
  overtimeHours: number;
  presentDays: number;
  absentDays: number;
  lateInstances: number;
  producedUnits: number;
}

export interface PayPulsePayrollRules {
  standardHours: number;
  overtimeMultiplier: number;
  lateDeductionPerInstance: number;
  absentDeductionPerDay: number;
  taxPercent: number;
}

export function calculatePayPulsePayroll(payModel: PayModel, baseRate: number, attendance: PayPulseAttendanceAggregate, rules: PayPulsePayrollRules) {
  let baseEarnings = 0;
  let overtimeEarnings = 0;
  const hourlyEquivalent = baseRate / rules.standardHours;

  switch (payModel) {
    case "HOURLY":
      baseEarnings = baseRate * attendance.totalHours;
      overtimeEarnings = baseRate * rules.overtimeMultiplier * attendance.overtimeHours;
      break;
    case "DAILY":
      baseEarnings = baseRate * attendance.presentDays;
      overtimeEarnings = hourlyEquivalent * rules.overtimeMultiplier * attendance.overtimeHours;
      break;
    case "QUANTITY":
      baseEarnings = baseRate * attendance.producedUnits;
      overtimeEarnings = hourlyEquivalent * rules.overtimeMultiplier * attendance.overtimeHours;
      break;
    case "MONTHLY":
      baseEarnings = baseRate;
      overtimeEarnings = (baseRate / (rules.standardHours * 26)) * rules.overtimeMultiplier * attendance.overtimeHours;
      break;
  }

  const grossEarnings = baseEarnings + overtimeEarnings;
  const lateDeduction = attendance.lateInstances * rules.lateDeductionPerInstance;
  const absentDeduction = attendance.absentDays * rules.absentDeductionPerDay;
  const taxDeduction = grossEarnings * (rules.taxPercent / 100);
  const totalDeductions = lateDeduction + absentDeduction + taxDeduction;

  return {
    payModel,
    baseEarnings,
    overtimeEarnings,
    grossEarnings,
    lateDeduction,
    absentDeduction,
    taxDeduction,
    totalDeductions,
    netPayable: Math.max(0, grossEarnings - totalDeductions),
  };
}
"use server";

import { FestivalBonusBasis } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getWritableUser, guestWriteResult, isHRAdmin } from "@/lib/auth";
import { getAccessibleCompanyIds } from "@/lib/company";
import { festivalBonusFormula, MAX_FESTIVAL_BONUS_PERCENTAGE, payoutMonthsLabel } from "@/lib/festival-bonus";

export type FestivalBonusActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Creates or updates one company's festival bonus policy for a year (`useActionState` action).
 * Guests are refused before anything else; only HR admins may save, and only for companies they can access.
 */
export async function saveFestivalBonusPolicy(_prev: FestivalBonusActionResult | null, formData: FormData): Promise<FestivalBonusActionResult> {
  const user = await getWritableUser();
  if (!user) return guestWriteResult;
  if (!isHRAdmin(user.role)) return { ok: false, error: "Only HR administrators can configure festival bonuses" };

  const companyId = String(formData.get("companyId") ?? "");
  const year = Number(formData.get("year"));
  const basis = String(formData.get("targetBasis") ?? "");
  const percentage = Number(formData.get("percentage"));
  const enabled = formData.get("enabled") === "on";
  const payoutMonths = [...new Set(formData.getAll("payoutMonths").map(Number))].sort((a, b) => a - b);

  if (!companyId) return { ok: false, error: "Choose a company" };
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, error: "Choose a valid year" };
  if (!Object.values(FestivalBonusBasis).includes(basis as FestivalBonusBasis)) return { ok: false, error: "Choose what the bonus is calculated on" };
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > MAX_FESTIVAL_BONUS_PERCENTAGE) {
    return { ok: false, error: `Percentage must be more than 0 and at most ${MAX_FESTIVAL_BONUS_PERCENTAGE}` };
  }
  if (payoutMonths.some((month) => !Number.isInteger(month) || month < 1 || month > 12)) return { ok: false, error: "Choose valid payout months" };
  if (enabled && payoutMonths.length === 0) return { ok: false, error: "Choose at least one payout month, or turn the bonus off" };

  const accessibleIds = await getAccessibleCompanyIds(user);
  if (accessibleIds && !accessibleIds.includes(companyId)) return { ok: false, error: "You do not have access to this company" };
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  if (!company) return { ok: false, error: "Company not found" };

  const data = {
    targetBasis: basis as FestivalBonusBasis,
    percentage: Math.round(percentage * 100) / 100,
    payoutMonths,
    enabled,
    updatedById: user.id,
  };
  await prisma.festivalBonusPolicy.upsert({
    where: { companyId_year: { companyId, year } },
    create: { companyId, year, ...data },
    update: data,
  });

  revalidatePath("/dashboard/payroll");
  return {
    ok: true,
    message: enabled
      ? `${company.name} ${year}: ${festivalBonusFormula(data)}, paid in ${payoutMonthsLabel(payoutMonths)}`
      : `${company.name} ${year}: festival bonus turned off`,
  };
}

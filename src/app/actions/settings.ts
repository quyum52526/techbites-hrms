"use server";

import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getActiveUser } from "@/lib/auth";

export type SettingsActionResult = { ok: true; message: string } | { ok: false; error: string };

async function requireSettingsAdmin() {
  const user = await getActiveUser();
  if (user.role !== Role.SUPER_ADMIN && user.role !== Role.HR_ADMIN) {
    throw new Error("You do not have permission to change shift settings");
  }
  return user;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_GRACE_MINUTES = 120;

/** `useActionState` action: validation problems come back as `{ ok: false }`, missing permission throws. */
export async function updateShiftConfig(_prev: SettingsActionResult | null, formData: FormData): Promise<SettingsActionResult> {
  await requireSettingsAdmin();

  const shiftId = formData.get("shiftId");
  const startTime = formData.get("startTime");
  const endTime = formData.get("endTime");
  const graceMinutes = Number(formData.get("graceMinutes"));

  if (typeof shiftId !== "string" || !shiftId) return { ok: false, error: "Shift not found" };
  if (typeof startTime !== "string" || !TIME_PATTERN.test(startTime) || typeof endTime !== "string" || !TIME_PATTERN.test(endTime)) {
    return { ok: false, error: "Enter start and end times as HH:MM" };
  }
  if (!Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > MAX_GRACE_MINUTES) {
    return { ok: false, error: `Grace window must be a whole number from 0 to ${MAX_GRACE_MINUTES} minutes` };
  }

  const { count } = await prisma.shift.updateMany({
    where: { id: shiftId },
    data: { startTime, endTime, graceMinutes },
  });
  if (count === 0) return { ok: false, error: "Shift not found" };

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/attendance");
  return { ok: true, message: "Saved successfully" };
}

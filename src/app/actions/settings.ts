"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateShiftConfig(formData: FormData) {
  const shiftId = formData.get("shiftId") as string;
  const startTime = formData.get("startTime") as string;
  const endTime = formData.get("endTime") as string;
  const graceMinutes = parseInt(formData.get("graceMinutes") as string, 10);

  if (!shiftId || !startTime || !endTime || isNaN(graceMinutes)) {
    throw new Error("Missing shift parameters");
  }

  await prisma.shift.update({
    where: { id: shiftId },
    data: {
      startTime,
      endTime,
      graceMinutes,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/attendance");
}
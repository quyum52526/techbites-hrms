"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleAttendance(employeeId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingRecord = await prisma.attendanceRecord.findFirst({
    where: {
      employeeId,
      date: today,
    },
  });

  if (!existingRecord) {
    // Clock-in
    await prisma.attendanceRecord.create({
      data: {
        employeeId,
        date: today,
        checkIn: new Date(),
        status: "PRESENT",
        source: "WEB",
      },
    });
  } else if (!existingRecord.checkOut) {
    // Clock-out
    await prisma.attendanceRecord.update({
      where: { id: existingRecord.id },
      data: {
        checkOut: new Date(),
      },
    });
  }

  revalidatePath("/dashboard");
}
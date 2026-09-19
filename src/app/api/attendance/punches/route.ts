import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseZktecoPunchLog, type ParsedPunch } from "@/lib/zkteco";

function jsonPunches(value: unknown): ParsedPunch[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const punch = item as Record<string, unknown>;
    if (typeof punch.deviceUserId !== "string" || typeof punch.timestamp !== "string") return [];
    const timestamp = new Date(punch.timestamp);
    if (Number.isNaN(timestamp.getTime())) return [];
    return [{ deviceUserId: punch.deviceUserId, timestamp, status: typeof punch.status === "string" ? punch.status : undefined }];
  });
}

function punchType(status?: string) {
  return status === "0" ? "CHECK_IN" : status === "1" ? "CHECK_OUT" : null;
}

export async function POST(request: Request) {
  const expectedKey = process.env.ZKTECO_API_KEY;
  const providedKey = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expectedKey || providedKey !== expectedKey) return NextResponse.json({ ok: false, error: "Invalid API key" }, { status: 401 });

  const url = new URL(request.url);
  const deviceSn = url.searchParams.get("SN") ?? "unknown";
  const companyId = request.headers.get("x-company-id");
  if (!companyId) return NextResponse.json({ ok: false, error: "Missing x-company-id" }, { status: 400 });

  const contentType = request.headers.get("content-type") ?? "";
  const punches = contentType.includes("application/json")
    ? jsonPunches((await request.json() as { punches?: unknown }).punches)
    : parseZktecoPunchLog(await request.text());
  if (punches.length === 0) return NextResponse.json({ ok: false, error: "No punches found" }, { status: 400 });

  const ids = [...new Set(punches.map((punch) => punch.deviceUserId))];
  const employees = await prisma.employee.findMany({ where: { companyId, biometricId: { in: ids } }, select: { id: true, biometricId: true } });
  const employeeByBiometric = new Map(employees.map((employee) => [employee.biometricId, employee.id]));
  const now = new Date();

  await prisma.device.upsert({
    where: { company_id_device_sn: { company_id: companyId, device_sn: deviceSn } },
    create: { company_id: companyId, device_sn: deviceSn, last_seen_at: now },
    update: { last_seen_at: now },
  });
  const inserted = await prisma.rawAttendanceLog.createMany({
    data: punches.map((punch) => ({
      company_id: companyId,
      device_sn: deviceSn,
      device_user_id: punch.deviceUserId,
      employee_id: employeeByBiometric.get(punch.deviceUserId) ?? null,
      punch_type: punchType(punch.status),
      punch_timestamp: punch.timestamp,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, ingestedCount: inserted.count, duplicateCount: punches.length - inserted.count, unmappedDeviceUserIds: ids.filter((id) => !employeeByBiometric.has(id)) });
}
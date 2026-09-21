import { prisma } from "@/lib/prisma";
import { getActiveUser, isHRAdmin, type ActiveUser } from "@/lib/auth";

/**
 * Serves an uploaded employee image. NID scans are personal data, so each request is checked:
 * HR admins can open any file, a read-only guest only files of employees in the showcase company, everyone else
 * only files on their own employee record.
 */
function canOpen(user: ActiveUser, file: { employeeId: string | null; employee: { companyId: string | null } | null }) {
  if (isHRAdmin(user.role)) return true;
  if (user.role === "GUEST") return !!user.companyId && file.employee?.companyId === user.companyId;
  return !!file.employeeId && file.employeeId === user.employeeId;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getActiveUser()]);

  const file = await prisma.storedFile.findUnique({
    where: { id },
    select: { employeeId: true, contentType: true, data: true, employee: { select: { companyId: true } } },
  });
  // Same response for "missing" and "not yours", so file ids cannot be probed.
  if (!file || !canOpen(user, file)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": "inline",
      // A replaced image gets a new id, so a cached copy never goes stale; `private` keeps it out of shared caches.
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}

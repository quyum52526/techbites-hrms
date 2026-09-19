import { prisma } from "@/lib/prisma";
import { getActiveUser, isHRAdmin } from "@/lib/auth";

/**
 * Serves an uploaded employee image. NID scans are personal data, so each request is checked:
 * HR admins can open any file, everyone else only files on their own employee record.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getActiveUser()]);

  const file = await prisma.storedFile.findUnique({
    where: { id },
    select: { employeeId: true, contentType: true, data: true },
  });
  // Same response for "missing" and "not yours", so file ids cannot be probed.
  if (!file || (!isHRAdmin(user.role) && (!file.employeeId || file.employeeId !== user.employeeId))) {
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

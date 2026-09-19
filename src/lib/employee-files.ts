import type { Prisma } from "@prisma/client";

/**
 * Employee image uploads (photo, NID scan). Files live in the StoredFile table and are served by
 * /api/files/[id], which checks access; swapping to object storage later only changes `saveEmployeeImages`.
 */
export const EMPLOYEE_IMAGE_FIELDS = [
  { input: "photo", kind: "PHOTO", urlField: "photoUrl", label: "Photo" },
  { input: "nidScan", kind: "NID_SCAN", urlField: "nidScanUrl", label: "NID scan" },
] as const;

type ImageField = (typeof EMPLOYEE_IMAGE_FIELDS)[number];
type UrlField = ImageField["urlField"];

/** The browser resizes images first, so this only stops oversized or unprocessed files. */
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

const STORED_FILE_URL = /^\/api\/files\/([a-z0-9]+)$/i;

export const storedFileUrl = (id: string) => `/api/files/${id}`;
export const storedFileIdFromUrl = (url: string | null) => (url ? (STORED_FILE_URL.exec(url)?.[1] ?? null) : null);

/** The type is read from the file's own bytes; the browser-supplied MIME type is not trusted. */
function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

type PendingImage = { field: ImageField; contentType: string; data: Buffer } | { field: ImageField; remove: true };

/**
 * Reads the `<input>File` / `<input>Remove` pairs from a form. Returns only the fields that change;
 * an untouched picker leaves the stored image as it is.
 */
export async function readEmployeeImages(
  formData: FormData
): Promise<{ ok: true; images: PendingImage[] } | { ok: false; error: string }> {
  const images: PendingImage[] = [];
  for (const field of EMPLOYEE_IMAGE_FIELDS) {
    const file = formData.get(`${field.input}File`);
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_IMAGE_BYTES) {
        return { ok: false, error: `${field.label} is too large; the limit is ${MAX_IMAGE_BYTES / 1024 / 1024} MB` };
      }
      const data = Buffer.from(await file.arrayBuffer());
      const contentType = sniffImageType(data);
      if (!contentType) return { ok: false, error: `${field.label} must be a JPEG, PNG or WebP image` };
      images.push({ field, contentType, data });
    } else if (formData.get(`${field.input}Remove`) === "1") {
      images.push({ field, remove: true });
    }
  }
  return { ok: true, images };
}

/**
 * Applies pending image changes inside the caller's transaction: stores new files, deletes the files they replace,
 * and returns the URL fields to write on the employee.
 */
export async function saveEmployeeImages(
  tx: Prisma.TransactionClient,
  employeeId: string,
  images: PendingImage[],
  currentUrls: Partial<Record<UrlField, string | null>> = {}
): Promise<Partial<Record<UrlField, string | null>>> {
  const urls: Partial<Record<UrlField, string | null>> = {};
  for (const image of images) {
    const previousId = storedFileIdFromUrl(currentUrls[image.field.urlField] ?? null);
    if (previousId) await tx.storedFile.deleteMany({ where: { id: previousId, employeeId } });

    if ("remove" in image) {
      urls[image.field.urlField] = null;
    } else {
      const stored = await tx.storedFile.create({
        data: {
          employeeId,
          kind: image.field.kind,
          contentType: image.contentType,
          size: image.data.length,
          data: image.data,
        },
        select: { id: true },
      });
      urls[image.field.urlField] = storedFileUrl(stored.id);
    }
  }
  return urls;
}

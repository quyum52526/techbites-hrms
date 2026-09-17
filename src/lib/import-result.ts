export type ImportIssue = { line: number; message: string };

export type ImportResult = {
  ok: boolean;
  message: string;
  stats: { label: string; value: number }[];
  issues: ImportIssue[];
};

export const MAX_IMPORT_FILE_BYTES = 3 * 1024 * 1024;

/** Validates the uploaded file and returns its text, or an ImportResult describing why it was rejected. */
export async function readUploadedCsv(formData: FormData): Promise<{ ok: true; text: string } | { ok: false; result: ImportResult }> {
  const file = formData.get("file");
  const fail = (message: string) => ({ ok: false as const, result: { ok: false, message, stats: [], issues: [] } });

  if (!(file instanceof File) || file.size === 0) return fail("Choose a non-empty .csv file to upload");
  if (!file.name.toLowerCase().endsWith(".csv")) return fail("Only .csv files are supported");
  if (file.size > MAX_IMPORT_FILE_BYTES) return fail("CSV file is larger than 3 MB — split it into smaller files");

  return { ok: true, text: await file.text() };
}

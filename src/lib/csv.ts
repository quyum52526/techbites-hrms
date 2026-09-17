/** Headers are matched loosely: "First Name", "first_name" and "firstName" all become "firstname". */
export const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Minimal RFC 4180 parser: quoted fields, escaped quotes (""), embedded commas/newlines, CRLF, UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export type CsvRecord = { line: number; values: Record<string, string> };

/**
 * Parses CSV text into records keyed by normalized header. Blank lines are skipped;
 * `line` is the 1-based line number in the file (header = line 1) for error reporting.
 */
export function readCsvRecords(
  text: string,
  requiredHeaders: string[]
): { ok: true; records: CsvRecord[] } | { ok: false; error: string } {
  const rows = parseCsv(text);
  if (rows.length === 0) return { ok: false, error: "The CSV file is empty" };

  const headers = rows[0].map(normalizeHeader);
  const missing = requiredHeaders.filter((h) => !headers.includes(normalizeHeader(h)));
  if (missing.length > 0) {
    return { ok: false, error: `Missing required column(s): ${missing.join(", ")}` };
  }

  const records: CsvRecord[] = [];
  rows.slice(1).forEach((cells, index) => {
    if (cells.every((cell) => cell.trim() === "")) return;
    const values: Record<string, string> = {};
    headers.forEach((header, col) => {
      if (header) values[header] = (cells[col] ?? "").trim();
    });
    records.push({ line: index + 2, values });
  });

  if (records.length === 0) return { ok: false, error: "The CSV file has a header row but no data rows" };
  return { ok: true, records };
}

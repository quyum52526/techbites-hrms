export interface ParsedPunch {
  deviceUserId: string;
  timestamp: Date;
  status?: string;
  verifyMode?: string;
  punchType?: "CHECK_IN" | "CHECK_OUT";
}

const LINE_PATTERN = /^(\S+)\s+(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})(?:\s+(\S+))?(?:\s+(\S+))?/;

export function parseZktecoPunchLine(line: string): ParsedPunch | null {
  const match = LINE_PATTERN.exec(line.trim());
  if (!match) return null;

  const [, deviceUserId, rawTimestamp, status, verifyMode] = match;
  const timestamp = new Date(`${rawTimestamp.replace(" ", "T")}Z`);
  if (Number.isNaN(timestamp.getTime())) return null;

  return { deviceUserId, timestamp, status, verifyMode };
}

export function parseZktecoPunchLog(raw: string): ParsedPunch[] {
  return raw
    .split(/\r?\n/)
    .map(parseZktecoPunchLine)
    .filter((punch): punch is ParsedPunch => punch !== null);
}
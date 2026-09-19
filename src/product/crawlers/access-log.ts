// Reads the combined access log format nginx, Apache and Caddy all emit, so a
// self-hoster needs no CDN contract to answer "did the crawler actually fetch
// this page". Parsed by hand: the architecture test bans regexes.
//
//   1.2.3.4 - - [19/Sep/2026:12:00:00 +0000] "GET /p HTTP/1.1" 200 12 "ref" "ua"

export interface AccessLogEntry {
  path: string;
  method: string;
  status: number;
  userAgent: string;
  at: string | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "19/Sep/2026:12:00:00 +0000" to ISO, without a regex or a date library. */
export function parseLogTimestamp(value: string): string | null {
  const [datePart, ...timeParts] = value.split(":");
  if (!datePart || timeParts.length < 3) return null;
  const [day, month, year] = datePart.split("/");
  if (!day || !month || !year) return null;
  const monthIndex = MONTHS.indexOf(month);
  if (monthIndex === -1) return null;
  const [hour, minute, secondAndZone] = timeParts;
  const second = (secondAndZone || "").split(" ")[0];
  if (!hour || !minute || !second) return null;
  const stamp = Date.UTC(Number(year), monthIndex, Number(day), Number(hour), Number(minute), Number(second));
  return Number.isFinite(stamp) ? new Date(stamp).toISOString() : null;
}

function quotedSections(line: string): string[] {
  const out: string[] = [];
  let cursor = 0;
  for (;;) {
    const open = line.indexOf('"', cursor);
    if (open === -1) break;
    const close = line.indexOf('"', open + 1);
    if (close === -1) break;
    out.push(line.slice(open + 1, close));
    cursor = close + 1;
  }
  return out;
}

export function parseAccessLogLine(line: string): AccessLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const quoted = quotedSections(trimmed);
  // request, referrer, user-agent. A line without all three is not this format.
  if (quoted.length < 3) return null;
  const request = quoted[0] || "";
  const userAgent = quoted[quoted.length - 1] || "";
  const [method, path] = request.split(" ");
  if (!method || !path) return null;

  const openBracket = trimmed.indexOf("[");
  const closeBracket = trimmed.indexOf("]", openBracket + 1);
  const at = openBracket !== -1 && closeBracket !== -1
    ? parseLogTimestamp(trimmed.slice(openBracket + 1, closeBracket))
    : null;

  // The status follows the closing quote of the request section.
  const afterRequest = trimmed.slice(trimmed.indexOf('"' + request + '"') + request.length + 2).trim();
  const status = Number((afterRequest.split(" ")[0] || "").trim());

  return {
    method,
    path,
    status: Number.isFinite(status) ? status : 0,
    userAgent,
    at,
  };
}

export function parseAccessLog(text: string): AccessLogEntry[] {
  const out: AccessLogEntry[] = [];
  for (const line of text.split("\n").join("\r").split("\r")) {
    const entry = parseAccessLogLine(line);
    if (entry) out.push(entry);
  }
  return out;
}

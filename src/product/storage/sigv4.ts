import { createHash, createHmac } from "node:crypto";

// AWS Signature Version 4, by hand. The SDK is a large supply chain for four
// calls against one bucket.

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: Uint8Array | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

/** Percent-encoding per RFC 3986, which is stricter than encodeURIComponent. */
function encodeSegment(value: string): string {
  let out = "";
  for (const character of value) {
    const unreserved = (character >= "A" && character <= "Z")
      || (character >= "a" && character <= "z")
      || (character >= "0" && character <= "9")
      || character === "-" || character === "_" || character === "." || character === "~";
    if (unreserved) { out += character; continue; }
    for (const byte of Buffer.from(character, "utf8")) out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

export function encodeKeyPath(key: string): string {
  return key.split("/").map(encodeSegment).join("/");
}

// S3 signs the path once. Every other service signs the already-encoded path a
// second time, so a resource id carrying a colon or a slash still verifies.
function canonicalPath(url: URL, service: string): string {
  return service === "s3" ? encodeKeyPath(decodeURIComponent(url.pathname)) : encodeKeyPath(url.pathname);
}

/** Exported so it can be checked against the vector AWS publishes. */
export function deriveSigningKey(secretAccessKey: string, date: string, region: string, service: string): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}

function amzStamp(now: Date): string {
  const iso = now.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
}

export interface SigningKeys {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string | undefined;
  region: string;
  service: string;
}

export function signRequest(
  request: { method: string; url: URL; headers?: Record<string, string>; body: string },
  keys: SigningKeys,
  now = new Date(),
): Record<string, string> {
  const stamp = amzStamp(now);
  const date = stamp.slice(0, 8);
  const payloadHash = sha256Hex(request.body);

  // Lowercased up front, because the canonical form is built from these names.
  const headers = new Map<string, string>();
  for (const [name, value] of Object.entries(request.headers || {})) headers.set(name.toLowerCase(), String(value).trim());
  headers.set("host", request.url.host);
  headers.set("x-amz-date", stamp);
  headers.set("x-amz-content-sha256", payloadHash);
  if (keys.sessionToken) headers.set("x-amz-security-token", keys.sessionToken);

  const names = [...headers.keys()].sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers.get(name)}\n`).join("");
  const signedHeaders = names.join(";");

  const query = [...request.url.searchParams.entries()]
    .map(([name, value]) => [encodeSegment(name), encodeSegment(value)] as const)
    .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : left[1] < right[1] ? -1 : 1))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");

  const canonicalRequest = [
    request.method,
    canonicalPath(request.url, keys.service),
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${date}/${keys.region}/${keys.service}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", stamp, scope, sha256Hex(canonicalRequest)].join("\n");
  const signature = createHmac("sha256", deriveSigningKey(keys.secretAccessKey, date, keys.region, keys.service))
    .update(toSign, "utf8")
    .digest("hex");

  const out: Record<string, string> = {};
  for (const name of names) out[name] = headers.get(name) as string;
  out.authorization = `AWS4-HMAC-SHA256 Credential=${keys.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return out;
}

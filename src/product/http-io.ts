// HTTP transport helpers, shared by the server and nothing else. Separated so
// the composition root holds only the service graph and the router holds only
// routing.
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

export function httpsRequest(req: IncomingMessage): boolean {
  const forwarded = req.headers["x-forwarded-proto"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (value || "").split(",")[0]?.trim() === "https";
}

export async function formOrJsonBody(req: IncomingMessage): Promise<Record<string, string>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  const type = String(req.headers["content-type"] || "");
  if (type.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) if (typeof value === "string") out[key] = value;
      return out;
    } catch {
      return {};
    }
  }
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  for (const [key, value] of params) out[key] = value;
  return out;
}

export function send(res: ServerResponse, status: number, body: unknown, contentType = "application/json"): void {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(contentType === "application/json" ? JSON.stringify(body, null, 2) : String(body));
}

export async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function assetContentType(path: string): string {
  const ext = extname(path).toLowerCase();
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

export async function sendAsset(res: ServerResponse, path: string): Promise<void> {
  res.writeHead(200, {
    "Content-Type": assetContentType(path),
    "Cache-Control": "public, max-age=3600",
  });
  res.end(await readFile(path));
}

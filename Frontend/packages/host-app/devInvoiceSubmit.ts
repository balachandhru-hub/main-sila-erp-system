import { spawn } from "child_process";
import type { IncomingMessage, ServerResponse } from "http";
import path from "path";
import { fileURLToPath } from "url";
import type { Plugin } from "vite";

/**
 * The connected API has no invoice submit route yet, so that post answers with an empty 404.
 * In dev, the invoice is sent through the posting route the API already has. Once submit exists,
 * its response is used as-is.
 */

const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "devInvoiceSubmit.py");

const readRequestBody = (req: IncomingMessage): Promise<string> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});

const send = (res: ServerResponse, status: number, contentType: string, body: string): void => {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.end(body);
};

const described = (status: number, message: string, description: string): string =>
  JSON.stringify({ status_code: status, message, description });

const forward = async (
  target: string,
  req: IncomingMessage,
  method: string,
  urlPath: string,
  body: string | null,
): Promise<{ status: number; body: string; contentType: string }> => {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  if (req.headers.authorization) headers.Authorization = String(req.headers.authorization);
  if (body != null) headers["Content-Type"] = "application/json";
  const response = await fetch(new URL(urlPath, target), { method, headers, body: body ?? undefined });
  return {
    status: response.status,
    body: await response.text(),
    contentType: response.headers.get("content-type") || "application/json",
  };
};

const run = (settingsPath: string, payload: Record<string, unknown>): Promise<{ ok: boolean; postingId?: string; status?: number; message?: string; description?: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn("python3", [scriptPath]);
    const timer = setTimeout(() => child.kill(), 25000);
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(stdout || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify({ ...payload, settings: settingsPath }));
  });

/** Dev-only send for POST /api/v1/buyer/sila/invoices/{id}/submit while that route is absent. */
export const devInvoiceSubmit = (target: string, settingsPath: string): Plugin => ({
  name: "dev-invoice-submit",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const match = (req.url || "").match(/^\/api\/v1\/buyer\/sila\/invoices\/([0-9a-fA-F-]{36})\/submit(?:\?|$)/);
      if (!match || req.method !== "POST") {
        next();
        return;
      }
      const invoiceId = match[1];
      void handle(target, settingsPath, invoiceId, req, res).catch(() => {
        if (!res.headersSent) {
          send(res, 500, "application/json; charset=utf-8", described(500, "Invoice was not submitted.", "Invoice was not submitted."));
        }
      });
    });
  },
});

const handle = async (
  target: string,
  settingsPath: string,
  invoiceId: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  await readRequestBody(req);
  const route = `/api/v1/buyer/sila/invoices/${invoiceId}/submit`;
  const upstream = await forward(target, req, "POST", route, "");
  if (upstream.status !== 404 || upstream.body.trim()) {
    send(res, upstream.status, upstream.contentType, upstream.body);
    return;
  }

  const allowed = await forward(target, req, "GET", `/api/v1/buyer/sila/invoices/${invoiceId}`, null);
  if (allowed.status !== 200) {
    send(res, allowed.status, allowed.contentType, allowed.body);
    return;
  }

  const prepared = await run(settingsPath, { action: "prepare", invoiceId });
  if (!prepared.ok || !prepared.postingId) {
    const status = prepared.status || 500;
    send(res, status, "application/json; charset=utf-8", described(
      status,
      prepared.message || "Invoice was not submitted.",
      prepared.description || "Invoice was not submitted.",
    ));
    return;
  }

  const sent = await forward(target, req, "POST", `/api/v1/buyer/sila/erp-postings/${prepared.postingId}/reprocess`, "");
  const transportError = sent.status >= 200 && sent.status < 300
    ? ""
    : "The connected server did not accept the invoice posting.";
  await run(settingsPath, { action: "finish", invoiceId, postingId: prepared.postingId, transportError });
  const fresh = await forward(target, req, "GET", `/api/v1/buyer/sila/invoices/${invoiceId}`, null);
  send(res, fresh.status, fresh.contentType, fresh.body);
};

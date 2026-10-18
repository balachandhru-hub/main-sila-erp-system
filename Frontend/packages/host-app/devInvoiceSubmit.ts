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

const run = (settingsPath: string, payload: Record<string, unknown>): Promise<{ ok: boolean; postingId?: string; status?: number; message?: string; description?: string; reference?: string; technicalDetail?: string | null; erpMessage?: string | null; erpHttpStatus?: number | null; postingData?: unknown; lastAttemptAt?: string | null; invoice?: boolean }> =>
  new Promise((resolve, reject) => {
    const child = spawn("python3", [scriptPath]);
    const timer = setTimeout(() => child.kill(), 80000);
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
      const payloadMatch = (req.url || "").match(/^\/api\/v1\/buyer\/sila\/erp-postings\/([0-9a-fA-F-]{36})\/payload(?:\?|$)/);
      if (payloadMatch && req.method === "GET") {
        void handlePayload(target, settingsPath, payloadMatch[1], req, res).catch(() => {
          if (!res.headersSent) {
            send(res, 500, "application/json; charset=utf-8", described(500, "Could not open the transaction.", "Could not open the transaction."));
          }
        });
        return;
      }
      const deleteMatch = (req.url || "").match(/^\/api\/v1\/buyer\/integrations\/([0-9a-fA-F-]{36})(?:\?|$)/);
      if (deleteMatch && req.method === "DELETE") {
        void handleDelete(target, settingsPath, deleteMatch[1], req, res).catch(() => {
          if (!res.headersSent) {
            send(res, 500, "application/json; charset=utf-8", described(500, "Could not delete the integration.", "Could not delete the integration."));
          }
        });
        return;
      }
      const reprocessMatch = (req.url || "").match(/^\/api\/v1\/buyer\/sila\/erp-postings\/([0-9a-fA-F-]{36})\/reprocess(?:\?|$)/);
      if (reprocessMatch && req.method === "POST") {
        void handleReprocess(target, settingsPath, reprocessMatch[1], req, res).catch(() => {
          if (!res.headersSent) {
            send(res, 500, "application/json; charset=utf-8", described(500, "The posting could not be prepared or sent.", "The posting could not be prepared or sent."));
          }
        });
        return;
      }
      const invoiceRead = (req.url || "").match(/^\/api\/v1\/buyer\/sila\/invoices\/([0-9a-fA-F-]{36})\/?(?:\?|$)/);
      if (invoiceRead && req.method === "GET") {
        void handleInvoiceRead(target, settingsPath, invoiceRead[1], req, res).catch(() => {
          if (!res.headersSent) {
            send(res, 500, "application/json; charset=utf-8", described(500, "Could not load the invoice.", "Could not load the invoice."));
          }
        });
        return;
      }
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

const handleInvoiceRead = async (
  target: string,
  settingsPath: string,
  invoiceId: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const upstream = await forward(target, req, "GET", `/api/v1/buyer/sila/invoices/${invoiceId}`, null);
  if (upstream.status !== 200) {
    send(res, upstream.status, upstream.contentType, upstream.body);
    return;
  }
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(upstream.body) as Record<string, unknown>;
  } catch {
    send(res, upstream.status, upstream.contentType, upstream.body);
    return;
  }
  const nested = parsed["data"];
  const wrapped = nested && typeof nested === "object" ? nested as Record<string, unknown> : null;
  const invoice = wrapped || parsed;
  if (!invoice["postingData"]) {
    const stored = await run(settingsPath, { action: "posting", invoiceId });
    if (stored.postingData) {
      invoice["postingData"] = stored.postingData;
    }
  }
  send(res, 200, "application/json; charset=utf-8", JSON.stringify(parsed));
};

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

  const before = await run(settingsPath, { action: "attempt", postingId: prepared.postingId });
  const sent = await forward(target, req, "POST", `/api/v1/buyer/sila/erp-postings/${prepared.postingId}/reprocess`, "");
  await run(settingsPath, { action: "deliver", postingId: prepared.postingId, attemptBefore: before.lastAttemptAt || "" });
  const transportError = sent.status >= 200 && sent.status < 300
    ? ""
    : "The connected server did not accept the invoice posting.";
  await run(settingsPath, { action: "finish", invoiceId, postingId: prepared.postingId, transportError });
  const fresh = await forward(target, req, "GET", `/api/v1/buyer/sila/invoices/${invoiceId}`, null);
  send(res, fresh.status, fresh.contentType, fresh.body);
};

const handlePayload = async (
  target: string,
  settingsPath: string,
  postingId: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const route = `/api/v1/buyer/sila/erp-postings/${postingId}/payload`;
  const upstream = await forward(target, req, "GET", route, null);
  if (upstream.status !== 404 || upstream.body.trim()) {
    send(res, upstream.status, upstream.contentType, upstream.body);
    return;
  }

  const allowed = await forward(target, req, "GET", "/api/v1/buyer/sila/erp-postings?limit=1", null);
  if (allowed.status !== 200) {
    send(res, allowed.status, allowed.contentType, allowed.body);
    return;
  }

  const looked = await run(settingsPath, { action: "payload", postingId });
  const reference = (looked.reference || "").trim();
  if (!looked.ok || !reference) {
    const status = looked.status || 404;
    send(res, status, "application/json; charset=utf-8", described(
      status,
      looked.message || "Transaction not found.",
      looked.description || "Select a transaction from this tracker.",
    ));
    return;
  }

  const listed = await forward(
    target,
    req,
    "GET",
    `/api/v1/buyer/sila/erp-postings?search=${encodeURIComponent(reference)}&limit=50`,
    null,
  );
  if (listed.status !== 200) {
    send(res, listed.status, listed.contentType, listed.body);
    return;
  }

  let rows: Array<{ id?: string }> = [];
  try {
    const parsed = JSON.parse(listed.body) as unknown;
    if (Array.isArray(parsed)) rows = parsed as Array<{ id?: string }>;
  } catch {
    send(res, 502, "application/json; charset=utf-8", described(502, "Could not open the transaction.", "Could not open the transaction."));
    return;
  }
  const visible = rows.some((row) => (row.id || "").toLowerCase() === postingId.toLowerCase());
  if (!visible) {
    send(res, 404, "application/json; charset=utf-8", described(404, "Transaction not found.", "Select a transaction from this tracker."));
    return;
  }

  send(res, 200, "application/json; charset=utf-8", JSON.stringify({
    technicalDetail: looked.technicalDetail || "",
    erpMessage: looked.erpMessage || "",
    erpHttpStatus: looked.erpHttpStatus ?? null,
  }));
};

const handleReprocess = async (
  target: string,
  settingsPath: string,
  postingId: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  await readRequestBody(req);
  const before = await run(settingsPath, { action: "attempt", postingId });
  const upstream = await forward(target, req, "POST", `/api/v1/buyer/sila/erp-postings/${postingId}/reprocess`, "");
  if (before.invoice) {
    await run(settingsPath, { action: "deliver", postingId, attemptBefore: before.lastAttemptAt || "" });
  }
  send(res, upstream.status, upstream.contentType, upstream.body);
};

const handleDelete = async (
  target: string,
  settingsPath: string,
  configurationId: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const route = `/api/v1/buyer/integrations/${configurationId}`;
  const upstream = await forward(target, req, "DELETE", route, null);
  const missing = upstream.status === 405 || (upstream.status === 404 && !upstream.body.trim());
  if (!missing) {
    send(res, upstream.status, upstream.contentType, upstream.body);
    return;
  }

  const allowed = await forward(target, req, "GET", route, null);
  if (allowed.status !== 200) {
    send(res, allowed.status, allowed.contentType, allowed.body);
    return;
  }

  const removed = await run(settingsPath, { action: "delete", configurationId });
  if (!removed.ok) {
    const status = removed.status || 500;
    send(res, status, "application/json; charset=utf-8", described(
      status,
      removed.message || "Could not delete the integration.",
      removed.description || "Could not delete the integration.",
    ));
    return;
  }

  send(res, 200, "application/json; charset=utf-8", described(200, "Success", "Integration deleted."));
};

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

const localBuyerUrl = (): string =>
  (process.env.VITE_LOCAL_BUYER_API || "http://127.0.0.1:8004").replace(/\/$/, "");

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

interface DevFlowStep {
  name: string;
  status: string;
  detail?: string | null;
  request?: string | null;
  response?: string | null;
}

interface DevResult {
  ok: boolean;
  postingId?: string;
  status?: number;
  message?: string;
  description?: string;
  reference?: string;
  technicalDetail?: string | null;
  erpMessage?: string | null;
  erpHttpStatus?: number | null;
  postingData?: unknown;
  lastAttemptAt?: string | null;
  invoice?: boolean;
  id?: string;
  erpInvoiceId?: string | null;
  steps?: DevFlowStep[];
  results?: Array<{ id: string; erpInvoiceId?: string | null; message?: string | null }>;
  erpReference?: string | null;
  fiscalYear?: string | null;
  attachment?: {
    businessObject?: string;
    businessObjectType?: string;
    linkedSapObjectKey?: string | null;
    fileName?: string | null;
    url?: string | null;
    httpStatus?: number | null;
    status?: string;
    message?: string | null;
    canReprocess?: boolean;
  };
}

const run = (settingsPath: string, payload: Record<string, unknown>): Promise<DevResult> =>
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
      const resultsMatch = (req.url || "").match(/^\/api\/v1\/buyer\/sila\/erp-postings\/invoice-results(?:\?|$)/);
      if (resultsMatch && req.method === "POST") {
        void handleInvoiceResults(target, settingsPath, req, res).catch(() => {
          if (!res.headersSent) {
            send(res, 500, "application/json; charset=utf-8", described(500, "Could not load the transactions.", "Could not load the transactions."));
          }
        });
        return;
      }
      const flowMatch = (req.url || "").match(/^\/api\/v1\/buyer\/sila\/erp-postings\/([0-9a-fA-F-]{36})\/flow(?:\?|$)/);
      if (flowMatch && req.method === "GET") {
        void handleFlow(target, settingsPath, flowMatch[1], req, res).catch(() => {
          if (!res.headersSent) {
            send(res, 500, "application/json; charset=utf-8", described(500, "Could not open the transaction.", "Could not open the transaction."));
          }
        });
        return;
      }
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
        void handleReprocess(target, settingsPath, reprocessMatch[1], req, res).catch((error: unknown) => {
          if (!res.headersSent) {
            const detail = error instanceof Error && error.message.trim()
              ? error.message
              : "The posting could not be prepared or sent. Check the document and the ERP API.";
            send(res, 500, "application/json; charset=utf-8", described(500, detail, detail));
          }
        });
        return;
      }
      const attachmentMatch = (req.url || "").match(/^\/api\/v1\/buyer\/sila\/invoices\/([0-9a-fA-F-]{36})\/attachment\/reprocess(?:\?|$)/);
      if (attachmentMatch && req.method === "POST") {
        void handleAttachment(target, settingsPath, attachmentMatch[1], req, res).catch(() => {
          if (!res.headersSent) {
            send(res, 500, "application/json; charset=utf-8", described(500, "Could not reprocess the attachment.", "The invoice was not posted again."));
          }
        });
        return;
      }
      const copyMatch = (req.url || "").match(/^\/api\/v1\/buyer\/sila\/invoices\/([0-9a-fA-F-]{36})\/copy(?:\?|$)/);
      if (copyMatch && req.method === "POST") {
        void handleCopy(target, settingsPath, copyMatch[1], req, res).catch(() => {
          if (!res.headersSent) {
            send(res, 500, "application/json; charset=utf-8", described(500, "Could not copy the invoice.", "Could not copy the invoice."));
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

const handleAttachment = async (
  target: string,
  settingsPath: string,
  invoiceId: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  await readRequestBody(req);
  const route = `/api/v1/buyer/sila/invoices/${invoiceId}/attachment/reprocess`;
  const upstream = await forward(target, req, "POST", route, "{}");
  if (upstream.status !== 404 || upstream.body.trim()) {
    send(res, upstream.status, upstream.contentType, upstream.body);
    return;
  }
  const existing = await forward(target, req, "GET", `/api/v1/buyer/sila/invoices/${invoiceId}`, null);
  if (existing.status !== 200) {
    send(res, existing.status, existing.contentType, existing.body);
    return;
  }
  const sent = await run(settingsPath, { action: "attach", invoiceId });
  if (!sent.ok) {
    const status = sent.status || 500;
    send(res, status, "application/json; charset=utf-8", described(
      status,
      sent.message || "Could not reprocess the attachment.",
      sent.description || "The invoice was not posted again.",
    ));
    return;
  }
  const fresh = await forward(target, req, "GET", `/api/v1/buyer/sila/invoices/${invoiceId}`, null);
  if (fresh.status !== 200) {
    send(res, fresh.status, fresh.contentType, fresh.body);
    return;
  }
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(fresh.body) as Record<string, unknown>;
  } catch {
    send(res, fresh.status, fresh.contentType, fresh.body);
    return;
  }
  const nested = parsed["data"];
  const invoice = nested && typeof nested === "object" ? nested as Record<string, unknown> : parsed;
  const view = await run(settingsPath, { action: "attachment-view", invoiceId });
  if (view.ok && view.attachment) {
    if (view.erpReference) invoice["erpReference"] = view.erpReference;
    if (view.fiscalYear) invoice["fiscalYear"] = view.fiscalYear;
    invoice["attachment"] = view.attachment;
  }
  send(res, 200, "application/json; charset=utf-8", JSON.stringify(parsed));
};

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
  const view = await run(settingsPath, { action: "attachment-view", invoiceId });
  if (view.ok && view.attachment) {
    if (!invoice["erpReference"] && view.erpReference) invoice["erpReference"] = view.erpReference;
    if (!invoice["fiscalYear"] && view.fiscalYear) invoice["fiscalYear"] = view.fiscalYear;
    const current = invoice["attachment"] && typeof invoice["attachment"] === "object"
      ? invoice["attachment"] as Record<string, unknown>
      : {};
    const blank = (value: unknown): boolean => value == null || String(value).trim() === "" || String(value) === "Not started";
    invoice["attachment"] = {
      ...view.attachment,
      ...current,
      linkedSapObjectKey: blank(current["linkedSapObjectKey"]) ? view.attachment.linkedSapObjectKey : current["linkedSapObjectKey"],
      status: blank(current["status"]) ? view.attachment.status : current["status"],
      fileName: blank(current["fileName"]) ? view.attachment.fileName : current["fileName"],
      url: blank(current["url"]) ? view.attachment.url : current["url"],
      httpStatus: current["httpStatus"] == null ? view.attachment.httpStatus : current["httpStatus"],
      message: blank(current["message"]) ? view.attachment.message : current["message"],
      businessObject: current["businessObject"] || view.attachment.businessObject,
      businessObjectType: current["businessObjectType"] || view.attachment.businessObjectType,
      canReprocess: current["canReprocess"] === true || view.attachment.canReprocess === true,
    };
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

  try {
    const local = await forward(localBuyerUrl(), req, "POST", route, "");
    if (local.status !== 404 || local.body.trim()) {
      send(res, local.status, local.contentType, local.body);
      return;
    }
  } catch {
    // Local Buyer.API is not running; continue with the posting-route fallback.
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

const postingVisible = async (
  target: string,
  req: IncomingMessage,
  postingId: string,
  looked: DevResult,
): Promise<{ status: number; body: string; contentType: string } | null> => {
  const reference = (looked.reference || "").trim();
  if (!looked.ok || !reference) {
    const status = looked.status || 404;
    return {
      status,
      body: described(status, looked.message || "Transaction not found.", looked.description || "Select a transaction from this tracker."),
      contentType: "application/json; charset=utf-8",
    };
  }
  const listed = await forward(
    target,
    req,
    "GET",
    `/api/v1/buyer/sila/erp-postings?search=${encodeURIComponent(reference)}&limit=50`,
    null,
  );
  if (listed.status !== 200) return listed;
  let rows: Array<{ id?: string }> = [];
  try {
    const parsed = JSON.parse(listed.body) as unknown;
    if (Array.isArray(parsed)) rows = parsed as Array<{ id?: string }>;
  } catch {
    return { status: 502, body: described(502, "Could not open the transaction.", "Could not open the transaction."), contentType: "application/json; charset=utf-8" };
  }
  const visible = rows.some((row) => (row.id || "").toLowerCase() === postingId.toLowerCase());
  if (!visible) {
    return { status: 404, body: described(404, "Transaction not found.", "Select a transaction from this tracker."), contentType: "application/json; charset=utf-8" };
  }
  return null;
};

const handleFlow = async (
  target: string,
  settingsPath: string,
  postingId: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const route = `/api/v1/buyer/sila/erp-postings/${postingId}/flow`;
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
  const hidden = await postingVisible(target, req, postingId, looked);
  if (hidden) {
    send(res, hidden.status, hidden.contentType, hidden.body);
    return;
  }
  const flow = await run(settingsPath, { action: "flow", postingId });
  if (!flow.ok || !flow.steps) {
    const status = flow.status || 404;
    send(res, status, "application/json; charset=utf-8", described(
      status,
      flow.message || "Transaction not found.",
      flow.description || "Select an invoice transaction from this tracker.",
    ));
    return;
  }
  send(res, 200, "application/json; charset=utf-8", JSON.stringify({
    erpInvoiceId: flow.erpInvoiceId ?? null,
    message: flow.message ?? null,
    steps: flow.steps,
  }));
};

const handleInvoiceResults = async (
  target: string,
  settingsPath: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  const body = await readRequestBody(req);
  const route = "/api/v1/buyer/sila/erp-postings/invoice-results";
  const upstream = await forward(target, req, "POST", route, body || "{}");
  if (upstream.status !== 404 || upstream.body.trim()) {
    send(res, upstream.status, upstream.contentType, upstream.body);
    return;
  }
  const allowed = await forward(target, req, "GET", "/api/v1/buyer/sila/erp-postings?limit=1", null);
  if (allowed.status !== 200) {
    send(res, allowed.status, allowed.contentType, allowed.body);
    return;
  }
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(body || "{}") as { ids?: string[] };
    ids = Array.isArray(parsed.ids) ? parsed.ids : [];
  } catch {
    ids = [];
  }
  const visibleIds = new Set<string>();
  for (let index = 0; index < 1000; index += 200) {
    const listed = await forward(target, req, "GET", `/api/v1/buyer/sila/erp-postings?index=${index}&limit=200`, null);
    if (listed.status !== 200) break;
    let rows: Array<{ id?: string }> = [];
    try {
      const parsed = JSON.parse(listed.body) as unknown;
      if (Array.isArray(parsed)) rows = parsed as Array<{ id?: string }>;
    } catch {
      break;
    }
    rows.forEach((row) => {
      if (row.id) visibleIds.add(row.id.toLowerCase());
    });
    if (rows.length < 200) break;
  }
  const visible = ids.filter((id) => visibleIds.has(id.toLowerCase())).slice(0, 200);
  const annotated = await run(settingsPath, { action: "invoice-results", ids: visible });
  send(res, 200, "application/json; charset=utf-8", JSON.stringify({ results: annotated.results || [] }));
};

const handleCopy = async (
  target: string,
  settingsPath: string,
  invoiceId: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  await readRequestBody(req);
  const route = `/api/v1/buyer/sila/invoices/${invoiceId}/copy`;
  const upstream = await forward(target, req, "POST", route, "{}");
  if (upstream.status !== 404 || upstream.body.trim()) {
    send(res, upstream.status, upstream.contentType, upstream.body);
    return;
  }
  const existing = await forward(target, req, "GET", `/api/v1/buyer/sila/invoices/${invoiceId}`, null);
  if (existing.status !== 200) {
    send(res, existing.status, existing.contentType, existing.body);
    return;
  }
  const copied = await run(settingsPath, { action: "copy", invoiceId });
  if (!copied.ok || !copied.id) {
    const status = copied.status || 500;
    send(res, status, "application/json; charset=utf-8", described(
      status,
      copied.message || "Could not copy the invoice.",
      copied.description || "Could not copy the invoice.",
    ));
    return;
  }
  send(res, 200, "application/json; charset=utf-8", JSON.stringify({
    id: copied.id,
    status_code: 200,
    message: "Success",
    description: "Invoice copied. The copy is not posted to SAP.",
  }));
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
  const route = `/api/v1/buyer/sila/erp-postings/${postingId}/reprocess`;
  let upstream = await forward(target, req, "POST", route, "");
  const cloudMiss = (upstream.status === 404 && !upstream.body.trim())
    || (upstream.status >= 500 && /IntegrationProcessType|Cannot convert string value/i.test(upstream.body));
  if (cloudMiss) {
    try {
      const local = await forward(localBuyerUrl(), req, "POST", route, "");
      if (local.status !== 404 || local.body.trim()) {
        upstream = local;
      }
    } catch {
      // Local Buyer.API is not running; return the cloud error.
    }
  }
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

import { spawn } from "child_process";
import type { IncomingMessage, ServerResponse } from "http";
import path from "path";
import { fileURLToPath } from "url";
import type { Plugin } from "vite";

/**
 * The connected API has no goods-receipt link route yet, so that save answers with an empty 404.
 * In dev, the same match is written to the goods receipt the API already stores. Once the route
 * exists, its response is used as-is.
 */

const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "devGoodsReceiptLink.py");

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

const saveLocally = (settingsPath: string, invoiceId: string, goodsReceiptIds: unknown): Promise<{ ok: boolean; status?: number; message?: string; description?: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn("python3", [scriptPath, settingsPath]);
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
    child.stdin.end(JSON.stringify({ invoiceId, goodsReceiptIds }));
  });

/** Dev-only save for POST /api/v1/buyer/sila/invoices/{id}/goods-receipts while that route is absent. */
export const devGoodsReceiptLink = (target: string, settingsPath: string): Plugin => ({
  name: "dev-goods-receipt-link",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const match = (req.url || "").match(/^\/api\/v1\/buyer\/sila\/invoices\/([0-9a-fA-F-]{36})\/goods-receipts(?:\?|$)/);
      if (!match || req.method !== "POST") {
        next();
        return;
      }
      const invoiceId = match[1];
      void handle(target, settingsPath, invoiceId, req, res).catch(() => {
        if (!res.headersSent) {
          send(res, 500, "application/json; charset=utf-8", described(500, "Could not match the goods receipts.", "Could not match the goods receipts."));
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
  const raw = await readRequestBody(req);
  const route = `/api/v1/buyer/sila/invoices/${invoiceId}/goods-receipts`;
  const upstream = await forward(target, req, "POST", route, raw);
  // An empty 404 is the missing route. A 404 with a message is the real API and is returned as-is.
  if (upstream.status !== 404 || upstream.body.trim()) {
    send(res, upstream.status, upstream.contentType, upstream.body);
    return;
  }

  const allowed = await forward(target, req, "GET", `/api/v1/buyer/sila/invoices/${invoiceId}`, null);
  if (allowed.status !== 200) {
    send(res, allowed.status, allowed.contentType, allowed.body);
    return;
  }

  let goodsReceiptIds: unknown = [];
  try {
    const payload = JSON.parse(raw || "{}") as { goodsReceiptIds?: unknown };
    goodsReceiptIds = payload.goodsReceiptIds ?? [];
  } catch {
    send(res, 400, "application/json; charset=utf-8", described(400, "Goods receipt not found.", "Choose a goods receipt of this purchase order."));
    return;
  }

  const saved = await saveLocally(settingsPath, invoiceId, goodsReceiptIds);
  if (!saved.ok) {
    const status = saved.status || 500;
    send(res, status, "application/json; charset=utf-8", described(
      status,
      saved.message || "Could not match the goods receipts.",
      saved.description || "Could not match the goods receipts.",
    ));
    return;
  }

  const fresh = await forward(target, req, "GET", `/api/v1/buyer/sila/invoices/${invoiceId}`, null);
  send(res, fresh.status, fresh.contentType, fresh.body);
};

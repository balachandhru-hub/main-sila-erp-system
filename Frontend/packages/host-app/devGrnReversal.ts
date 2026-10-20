import type { IncomingMessage, ServerResponse } from "http";
import type { Plugin } from "vite";

/**
 * Cloud sila-api does not yet serve GET …/grns/{id}/reversal or POST …/reverse
 * (empty HTTP 404). localhost:6001 and /mobile share this host; both must use
 * the same Buyer API handlers — no separate PWA reversal logic.
 */

const REVERSAL_GET = /^\/api\/v1\/buyer\/sila\/grns\/([0-9a-fA-F-]{36})\/reversal(?:\?|$)/;
const REVERSAL_POST = /^\/api\/v1\/buyer\/sila\/grns\/([0-9a-fA-F-]{36})\/reverse(?:\?|$)/;

const send = (res: ServerResponse, status: number, contentType: string, body: string): void => {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  res.end(body);
};

const described = (status: number, message: string, description: string): string =>
  JSON.stringify({ status_code: status, message, description });

const localBuyerUrl = (): string =>
  (process.env.VITE_LOCAL_BUYER_API || "http://127.0.0.1:8004").replace(/\/$/, "");

const forward = async (
  target: string,
  req: IncomingMessage,
  method: string,
  urlPath: string,
  body: string | null,
): Promise<{ status: number; body: string; contentType: string; reachable: boolean }> => {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  if (req.headers.authorization) headers.Authorization = String(req.headers.authorization);
  if (body != null) headers["Content-Type"] = "application/json";
  try {
    const response = await fetch(new URL(urlPath, target), { method, headers, body: body ?? undefined });
    return {
      status: response.status,
      body: await response.text(),
      contentType: response.headers.get("content-type") || "application/json",
      reachable: true,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Buyer API is unreachable.";
    return {
      status: 503,
      body: described(503, "GRN_REVERSAL_API_UNREACHABLE", detail),
      contentType: "application/json; charset=utf-8",
      reachable: false,
    };
  }
};

const readRequestBody = (req: IncomingMessage): Promise<string> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});

/** Empty 404 or generic Not Found = undeployed route. GRN_NOT_FOUND is a real API answer. */
const isMissingRoute = (status: number, body: string): boolean => {
  if (status !== 404) return false;
  const text = body.trim();
  if (!text) return true;
  if (text.includes("GRN_NOT_FOUND")) return false;
  try {
    const parsed = JSON.parse(text) as { message?: unknown; Message?: unknown; description?: unknown; Description?: unknown };
    const message = String(parsed.message ?? parsed.Message ?? "").trim();
    const description = String(parsed.description ?? parsed.Description ?? "").trim();
    if (message === "GRN_NOT_FOUND") return false;
    if (description && !/not found on this server|was not found on this server/i.test(description)) {
      return message.toLowerCase() === "not found" && description.toLowerCase() === "not found";
    }
    return message.toLowerCase() === "not found" || message === "";
  } catch {
    return true;
  }
};

const handle = async (
  cloudTarget: string,
  req: IncomingMessage,
  res: ServerResponse,
  method: string,
  urlPath: string,
  body: string | null,
): Promise<void> => {
  const cloud = await forward(cloudTarget, req, method, urlPath, body);
  if (cloud.reachable && !isMissingRoute(cloud.status, cloud.body)) {
    send(res, cloud.status, cloud.contentType, cloud.body);
    return;
  }

  const local = await forward(localBuyerUrl(), req, method, urlPath, body);
  if (local.reachable) {
    send(res, local.status, local.contentType, local.body);
    return;
  }

  send(
    res,
    404,
    "application/json; charset=utf-8",
    described(
      404,
      "GRN_REVERSAL_ROUTE_NOT_DEPLOYED",
      "HTTP 404 — GET/POST …/grns/{id}/reversal is not on the connected cloud API. Start the Buyer API that already has this route (default http://127.0.0.1:8004), or deploy Buyer.API. A missing goods receipt returns GRN_NOT_FOUND.",
    ),
  );
};

/** Dev-only bridge for GRN reversal while cloud Buyer.API is behind this branch. */
export const devGrnReversal = (cloudTarget: string): Plugin => ({
  name: "dev-grn-reversal",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url || "";
      const getMatch = url.match(REVERSAL_GET);
      if (getMatch && req.method === "GET") {
        const path = `/api/v1/buyer/sila/grns/${getMatch[1]}/reversal`;
        void handle(cloudTarget, req, res, "GET", path, null).catch(() => {
          if (!res.headersSent) {
            send(res, 500, "application/json; charset=utf-8", described(500, "Could not load the goods receipt reversal.", "Could not load the goods receipt reversal."));
          }
        });
        return;
      }
      const postMatch = url.match(REVERSAL_POST);
      if (postMatch && req.method === "POST") {
        const path = `/api/v1/buyer/sila/grns/${postMatch[1]}/reverse`;
        void readRequestBody(req)
          .then((raw) => handle(cloudTarget, req, res, "POST", path, raw || "{}"))
          .catch(() => {
            if (!res.headersSent) {
              send(res, 500, "application/json; charset=utf-8", described(500, "Could not reverse the goods receipt.", "Could not reverse the goods receipt."));
            }
          });
        return;
      }
      next();
    });
  },
});

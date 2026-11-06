import type { IncomingMessage, ServerResponse } from "http";
import type { Plugin } from "vite";

/**
 * Dev host pins /api/v1/buyer to local :8004. When that process is down, SILA ME
 * dashboard, inventory, recipe and material screens all fail. Prefer local, then
 * the cloud Buyer API. Do not fall through on 401/404 from a reachable local API.
 */

type Upstream = { status: number; body: Buffer; contentType: string; setCookie?: string[] };

const described = (status: number, message: string, description: string) => ({
  status_code: status,
  message,
  description,
});

const unreachable = (target: string): Upstream => ({
  status: 503,
  body: Buffer.from(JSON.stringify(described(
    503,
    "Couldn't reach Buyer API.",
    `No service answered at ${target.replace(/\/$/, "")}.`,
  ))),
  contentType: "application/json; charset=utf-8",
});

const rewriteCookies = (cookies: string[] | undefined): string[] | undefined => {
  if (!cookies?.length) return cookies;
  return cookies.map((cookie) =>
    cookie
      .replace(/;\s*Domain=[^;]*/i, "")
      .replace(/;\s*SameSite=None/i, "; SameSite=Lax"),
  );
};

const readRequestBody = (req: IncomingMessage): Promise<Buffer | null> => {
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
};

const forward = async (
  target: string,
  req: IncomingMessage,
  body: Buffer | null,
): Promise<Upstream> => {
  const url = new URL(req.url || "/", target.endsWith("/") ? target : `${target}/`);
  const headers: Record<string, string> = { Accept: req.headers.accept || "application/json" };
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  if (req.headers.authorization) headers.Authorization = String(req.headers.authorization);
  if (body != null) headers["Content-Type"] = String(req.headers["content-type"] || "application/json");
  const response = await fetch(url, { method: req.method, headers, body: body ?? undefined });
  return {
    status: response.status,
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/json",
    setCookie: response.headers.getSetCookie?.() ?? undefined,
  };
};

const tryCall = async (target: string, req: IncomingMessage, body: Buffer | null): Promise<Upstream> => {
  try {
    return await forward(target, req, body);
  } catch {
    return unreachable(target);
  }
};

const passThrough = (res: ServerResponse, upstream: Upstream): void => {
  res.statusCode = upstream.status;
  res.setHeader("Content-Type", upstream.contentType);
  const cookies = rewriteCookies(upstream.setCookie);
  if (cookies?.length) res.setHeader("Set-Cookie", cookies);
  res.end(upstream.body);
};

export const devBuyerApiFallback = (primary: string, fallback: string): Plugin => ({
  name: "dev-buyer-api-fallback",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url || "";
      if (!url.startsWith("/api/v1/buyer")) {
        next();
        return;
      }
      void (async () => {
        const body = await readRequestBody(req);
        const first = await tryCall(primary, req, body);
        if (first.status !== 503 || !fallback || fallback === primary) {
          passThrough(res, first);
          return;
        }
        const second = await tryCall(fallback, req, body);
        passThrough(res, second.status === 503 ? first : second);
      })().catch(() => {
        if (!res.headersSent) passThrough(res, unreachable(primary));
      });
    });
  },
});

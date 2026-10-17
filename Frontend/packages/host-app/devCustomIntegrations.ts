import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import type { Plugin } from "vite";

/**
 * The API behind localhost still stores process type as a fixed list, so a new type such as GET_PRICE
 * is rejected before it is saved. In dev, that one case is kept here and mixed into the integration list.
 * A built-in type is always sent to the API. Once the API accepts a new type, the response is used as-is.
 */

const KNOWN_PROCESS_TYPES = new Set([
  "POST_PO", "GET_STOCK", "GET_MATERIAL", "GET_CONTRACT", "POST_SUPPLIER",
  "GET_CATALOG", "GET_CATALOG_STOCK", "POST_SALES_ORDER", "POST_GOODS_MOVEMENT",
  "UPDATE_STOCK", "POST_GRN", "GET_POS_SALE", "POST_INVOICE", "SUPPLIER_INVOICE_ATTACHMENT", "GET_SUPPLIER",
  "GET_PO", "EXTRACT_INVOICE", "POST_CONTRACT",
]);

const CUSTOM_PROCESS_TYPE = /^(GET_|POST_)[A-Z][A-Z0-9_]*$/;
const SECRET_FIELDS = ["password", "clientId", "clientSecret", "bearerToken", "apiKey"] as const;

type Side = "buyer" | "supplier";

interface StoredIntegration {
  public: Record<string, unknown>;
  secrets: Record<string, string>;
}

interface StoreFile {
  buyer: StoredIntegration[];
  supplier: StoredIntegration[];
}

const emptyStore = (): StoreFile => ({ buyer: [], supplier: [] });

const isCustomProcessType = (processType: unknown): processType is string =>
  typeof processType === "string"
  && processType.length <= 30
  && CUSTOM_PROCESS_TYPE.test(processType)
  && !KNOWN_PROCESS_TYPES.has(processType);

const readStore = (filePath: string): StoreFile => {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<StoreFile>;
    return {
      buyer: Array.isArray(parsed.buyer) ? parsed.buyer : [],
      supplier: Array.isArray(parsed.supplier) ? parsed.supplier : [],
    };
  } catch {
    return emptyStore();
  }
};

const writeStore = (filePath: string, store: StoreFile): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(store));
};

const readRequestBody = (req: IncomingMessage): Promise<string> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(payload));
  res.end(payload);
};

const described = (status: number, message: string, description: string) => ({
  status_code: status,
  message,
  description,
});

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const credentialStatus = (authenticationType: string, secrets: Record<string, string>): string => {
  if (authenticationType === "NONE") return "Not required";
  const configured = Boolean(secrets.password || secrets.clientSecret || secrets.bearerToken || secrets.apiKey);
  return configured ? "Configured" : "Missing";
};

const secretsFrom = (payload: Record<string, unknown>, previous: Record<string, string>): Record<string, string> => {
  const secrets = { ...previous };
  SECRET_FIELDS.forEach((field) => {
    if (payload[field] == null) return;
    const value = text(payload[field]);
    if (value) secrets[field] = value;
  });
  return secrets;
};

const publicFrom = (
  payload: Record<string, unknown>,
  current: Record<string, unknown> | null,
  secrets: Record<string, string>,
): Record<string, unknown> => {
  const now = new Date().toISOString();
  const authenticationType = text(payload.authenticationType) || "NONE";
  return {
    ...(current ?? {}),
    id: current?.id ?? randomUUID(),
    organizationId: current?.organizationId ?? "00000000-0000-0000-0000-000000000000",
    buyerId: current?.buyerId ?? "00000000-0000-0000-0000-000000000000",
    entityCode: text(payload.entityCode) || "ALL",
    name: text(payload.name),
    processType: text(payload.processType),
    protocol: text(payload.protocol) || "ODATA_V4",
    baseUrl: text(payload.baseUrl).replace(/\/+$/, ""),
    resourcePath: text(payload.resourcePath) || null,
    authenticationType,
    username: text(payload.username) || null,
    apiKeyHeader: text(payload.apiKeyHeader) || null,
    credentialStatus: credentialStatus(authenticationType, secrets),
    timeoutSeconds: Number(payload.timeoutSeconds ?? 30),
    retryCount: Number(payload.retryCount ?? 2),
    pageSize: payload.pageSize == null || payload.pageSize === "" ? null : Number(payload.pageSize),
    watermarkField: text(payload.watermarkField) || null,
    lastWatermark: current?.lastWatermark ?? null,
    lastAttemptAt: current?.lastAttemptAt ?? null,
    lastSuccessfulRunAt: current?.lastSuccessfulRunAt ?? null,
    nextRunAt: current?.nextRunAt ?? null,
    isRunning: false,
    lastErrorSafe: current?.lastErrorSafe ?? null,
    scheduleCron: text(payload.scheduleCron) || null,
    status: current?.status ?? "DRAFT",
    testedAt: current?.testedAt ?? null,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    systemName: text(payload.systemName) || null,
    httpMethod: text(payload.httpMethod) || "GET",
    payloadFormat: text(payload.payloadFormat) || "JSON",
    requestBody: text(payload.requestBody) || null,
    headers: payload.headers ?? null,
    tokenEndpoint: text(payload.tokenEndpoint) || null,
    tokenScope: text(payload.tokenScope) || null,
    tokenHeaders: payload.tokenHeaders ?? null,
    tokenBody: payload.tokenBody ?? null,
  };
};

const validate = (payload: Record<string, unknown>): string | null => {
  if (!text(payload.name) || !text(payload.entityCode || "ALL")) return "Enter the name and the entity code of the integration.";
  if (!isCustomProcessType(text(payload.processType))) return "Choose a built-in API type, or add one as GET_NAME (read) or POST_NAME (send), up to 30 characters.";
  let baseUrl: URL | null = null;
  try {
    baseUrl = new URL(text(payload.baseUrl));
  } catch {
    baseUrl = null;
  }
  if (!baseUrl || (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:")) {
    return "Base URL must be an absolute HTTPS or HTTP URL.";
  }
  return null;
};

const rejectedByEnum = (status: number, body: string): boolean =>
  status === 400 && body.includes("IntegrationProcessType");

const forward = async (
  target: string,
  req: IncomingMessage,
  body: string | null,
): Promise<{ status: number; body: string; contentType: string }> => {
  const url = new URL(req.url || "/", target);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (req.headers.cookie) headers.Cookie = req.headers.cookie;
  if (req.headers.authorization) headers.Authorization = String(req.headers.authorization);
  if (body != null) headers["Content-Type"] = "application/json";
  const response = await fetch(url, { method: req.method, headers, body: body ?? undefined });
  return {
    status: response.status,
    body: await response.text(),
    contentType: response.headers.get("content-type") || "application/json",
  };
};

const passThrough = (res: ServerResponse, upstream: { status: number; body: string; contentType: string }): void => {
  res.statusCode = upstream.status;
  res.setHeader("Content-Type", upstream.contentType);
  res.end(upstream.body);
};

/** Dev-only bridge so Save draft of a new API type succeeds while the connected API still rejects it. */
export const devCustomIntegrations = (target: string, filePath: string): Plugin => {
  return {
    name: "dev-custom-integrations",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        const match = url.match(/^\/api\/v1\/(buyer|supplier)\/integrations(?=\/|\?|$)/);
        if (!match) {
          next();
          return;
        }
        void handle(target, filePath, match[1] as Side, req, res, next).catch(() => {
          if (!res.headersSent) {
            sendJson(res, 500, described(500, "Could not save the integration.", "The draft could not be stored. Try again."));
          }
        });
      });
    },
  };
};

const handle = async (
  target: string,
  filePath: string,
  side: Side,
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): Promise<void> => {
  const url = new URL(req.url || "/", "https://localhost");
  const pathname = url.pathname.replace(/\/$/, "");
  const prefix = `/api/v1/${side}/integrations`;
  const rest = pathname.slice(prefix.length);
  const parts = rest.split("/").filter(Boolean);
  const store = () => readStore(filePath);
  const rows = () => store()[side];
  const find = (id: string) => rows().find((row) => row.public.id === id);

  if (req.method === "GET" && parts.length === 0) {
    const upstream = await forward(target, req, null);
    if (upstream.status !== 200) {
      passThrough(res, upstream);
      return;
    }
    let remote: unknown;
    try {
      remote = JSON.parse(upstream.body);
    } catch {
      passThrough(res, upstream);
      return;
    }
    const remoteRows = Array.isArray(remote) ? remote as Record<string, unknown>[] : [];
    const remoteIds = new Set(remoteRows.map((row) => row.id));
    const localRows = rows().map((row) => row.public).filter((row) => !remoteIds.has(row.id));
    sendJson(res, 200, [...remoteRows, ...localRows]);
    return;
  }

  if (req.method === "POST" && parts.length === 0) {
    const raw = await readRequestBody(req);
    const payload = JSON.parse(raw || "{}") as Record<string, unknown>;
    if (!isCustomProcessType(payload.processType)) {
      passThrough(res, await forward(target, req, raw));
      return;
    }
    const upstream = await forward(target, req, raw);
    if (!rejectedByEnum(upstream.status, upstream.body)) {
      passThrough(res, upstream);
      return;
    }
    const problem = validate(payload);
    if (problem) {
      sendJson(res, 400, described(400, "Integration could not be saved.", problem));
      return;
    }
    const current = store();
    const entityCode = text(payload.entityCode) || "ALL";
    const duplicate = current[side].some((row) =>
      row.public.processType === payload.processType
      && String(row.public.entityCode).toLowerCase() === entityCode.toLowerCase());
    if (duplicate) {
      sendJson(res, 409, described(
        409,
        "Integration already exists.",
        `An API of this type is already configured for entity code ${entityCode}. Open it and edit it, or use another entity code (company code).`,
      ));
      return;
    }
    const secrets = secretsFrom(payload, {});
    const created: StoredIntegration = { public: publicFrom(payload, null, secrets), secrets };
    current[side].push(created);
    writeStore(filePath, current);
    sendJson(res, 200, created.public);
    return;
  }

  const id = parts[0];
  const action = parts[1];
  const saved = id ? find(id) : undefined;
  if (!saved) {
    next();
    return;
  }

  if (req.method === "GET" && parts.length === 1) {
    sendJson(res, 200, saved.public);
    return;
  }

  if (req.method === "DELETE" && parts.length === 1) {
    const current = store();
    current[side] = current[side].filter((row) => row.public.id !== id);
    writeStore(filePath, current);
    sendJson(res, 200, {});
    return;
  }

  if (req.method === "PUT" && parts.length === 1) {
    const payload = JSON.parse(await readRequestBody(req) || "{}") as Record<string, unknown>;
    const problem = validate({ ...payload, processType: saved.public.processType });
    if (problem) {
      sendJson(res, 400, described(400, "Integration could not be saved.", problem));
      return;
    }
    const secrets = secretsFrom(payload, saved.secrets);
    const updated: StoredIntegration = {
      secrets,
      public: publicFrom({ ...payload, processType: saved.public.processType }, saved.public, secrets),
    };
    const current = store();
    current[side] = current[side].map((row) => (row.public.id === id ? updated : row));
    writeStore(filePath, current);
    sendJson(res, 200, updated.public);
    return;
  }

  if (req.method === "POST" && action === "test") {
    const result = await testConnection(saved);
    const current = store();
    current[side] = current[side].map((row) => {
      if (row.public.id !== id) return row;
      const status = row.public.status === "ACTIVE" ? "ACTIVE" : (result.success ? "TESTED" : "TEST_FAILED");
      return {
        ...row,
        public: {
          ...row.public,
          status,
          testedAt: result.testedAt,
          updatedAt: result.testedAt,
          lastErrorSafe: result.success ? null : result.message,
        },
      };
    });
    writeStore(filePath, current);
    sendJson(res, 200, result);
    return;
  }

  if (req.method === "POST" && (action === "activate" || action === "deactivate")) {
    const nextStatus = action === "activate" ? "ACTIVE" : "INACTIVE";
    const current = store();
    current[side] = current[side].map((row) => (
      row.public.id === id ? { ...row, public: { ...row.public, status: nextStatus, updatedAt: new Date().toISOString() } } : row
    ));
    writeStore(filePath, current);
    sendJson(res, 200, {});
    return;
  }

  next();
};

const headerMap = (value: unknown): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (!value || typeof value !== "object") return headers;
  Object.entries(value as Record<string, unknown>).forEach(([name, headerValue]) => {
    if (typeof headerValue === "string") headers[name] = headerValue;
  });
  return headers;
};

/** Sign-in header for the probe. The password stays in the local draft and is not written to the answer. */
const authorizationHeader = (saved: StoredIntegration): Record<string, string> => {
  const auth = text(saved.public.authenticationType);
  if (auth === "BASIC") {
    const username = text(saved.public.username);
    const password = saved.secrets.password || "";
    if (!username || !password) return {};
    return { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` };
  }
  if (auth === "BEARER_TOKEN" && saved.secrets.bearerToken) {
    return { Authorization: `Bearer ${saved.secrets.bearerToken}` };
  }
  if (auth === "API_KEY" && saved.secrets.apiKey) {
    return { [text(saved.public.apiKeyHeader) || "X-API-KEY"]: saved.secrets.apiKey };
  }
  return {};
};

const probeUrl = (saved: StoredIntegration): URL => {
  const baseUrl = String(saved.public.baseUrl || "");
  const resourcePath = text(saved.public.resourcePath);
  const target = new URL(resourcePath ? `${baseUrl.replace(/\/+$/, "")}/${resourcePath.replace(/^\/+/, "")}` : baseUrl);
  if (text(saved.public.protocol) === "ODATA_V4" && !target.searchParams.has("$top")) {
    target.searchParams.set("$top", "1");
  }
  return target;
};

/**
 * Proves the endpoint and the sign-in. The probe is a GET, the same call Postman uses to fetch the SAP CSRF token
 * (x-csrf-token: Fetch plus Basic). It does not post the request body, so a stock transfer is not created.
 * A POST-only API that answers 405 is reachable and the credentials were accepted.
 */
const testConnection = async (saved: StoredIntegration): Promise<{ success: boolean; message: string; httpStatus: number | null; testedAt: string }> => {
  const testedAt = new Date().toISOString();
  let target: URL;
  try {
    target = probeUrl(saved);
  } catch {
    return { success: false, message: "The base URL could not be called.", httpStatus: null, testedAt };
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return { success: false, message: "The base URL could not be called.", httpStatus: null, testedAt };
  }
  const headers = { ...headerMap(saved.public.headers), ...authorizationHeader(saved) };
  const configuredMethod = text(saved.public.httpMethod) || "GET";
  const timeout = Number(saved.public.timeoutSeconds || 30) * 1000;
  try {
    const response = await fetch(target, { method: "GET", headers, signal: AbortSignal.timeout(timeout) });
    const success = response.ok || (configuredMethod !== "GET" && response.status === 405);
    return {
      success,
      message: success ? "API connection succeeded." : `The API returned HTTP ${response.status}.`,
      httpStatus: response.status,
      testedAt,
    };
  } catch {
    return { success: false, message: "The configured API could not be reached.", httpStatus: null, testedAt };
  }
};

import axios from "axios";

const asText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** First non-empty string among the given property names. */
const field = (body: Record<string, unknown>, names: string[]): string => {
  for (const name of names) {
    const text = asText(body[name]);
    if (text) return text;
  }
  return "";
};

const messagesOf = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  const text = asText(value);
  return text ? [text] : [];
};

/**
 * ASP.NET model binding answers with problem+json (`errors`), which has no description.
 * A new API type fails there on the service that still stores process type as an enum.
 */
const problemMessage = (errors: unknown): string => {
  if (!errors || typeof errors !== "object") return "";
  const sentences: string[] = [];
  let rejectedType = false;
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    const parts = messagesOf(value);
    const name = key.replace(/^\$\./, "");
    if (name === "processType" || parts.some((part) => part.includes("IntegrationProcessType"))) {
      rejectedType = true;
      continue;
    }
    // Binding the whole body fails together with the field that could not be read.
    if (name === "request" && parts.every((part) => part === "The request field is required.")) continue;
    for (const part of parts) {
      const sentence = part.replace(/\s+Path:[\s\S]*$/, "").trim();
      if (sentence && !sentences.includes(sentence)) sentences.push(sentence);
    }
  }
  if (rejectedType) {
    return "This API service only accepts the built-in API types. Choose one from the list. A new API type is stored once the integration service is updated.";
  }
  return sentences.slice(0, 3).join(" ");
};

const messageFromBody = (data: unknown): string => {
  let body = data;
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed || trimmed.startsWith("<")) return "";
    try {
      body = JSON.parse(trimmed);
    } catch {
      return trimmed.length <= 240 ? trimmed : "";
    }
  }
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  const described = field(record, ["description", "Description", "message", "Message", "detail", "Detail"]);
  if (described) return described;
  const fromErrors = problemMessage(record.errors ?? record.Errors);
  if (fromErrors) return fromErrors;
  const title = field(record, ["title", "Title"]);
  if (title && title !== "One or more validation errors occurred.") return title;
  return "";
};

/** User-facing text of a response body: description, message, or validation errors. */
export const readBody = (data: unknown): string => messageFromBody(data);

/** HTTP status from an Axios failure, or null. */
export const readHttpStatus = (error: unknown): number | null =>
  axios.isAxiosError(error) && typeof error.response?.status === "number" ? error.response.status : null;

/**
 * User-facing text of a failed call: the API's description/message, otherwise a status-aware fallback.
 * Empty 404 bodies (undeployed route) must not collapse to a vague sentence alone.
 */
export const readError = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const fromBody = messageFromBody(error.response?.data);
    if (fromBody) return fromBody;
    const status = error.response?.status;
    if (status === 404) {
      return `${fallback} (HTTP 404 — this route is not registered on the connected server.)`;
    }
    if (typeof status === "number") {
      return `${fallback} (HTTP ${status})`;
    }
    if (error.message) return `${fallback} (${error.message})`;
    return fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

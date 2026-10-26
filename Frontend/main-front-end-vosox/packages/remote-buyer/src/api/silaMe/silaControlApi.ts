import axios from "axios";
import axiosInstance from "../axiosInstance";
import { readError } from "../readError";

/** Cost controller decision on a count line. */
export type SilaLineDecision = "ACCEPT" | "RECOUNT" | "MORE_INFORMATION" | "REJECT";

export interface SilaStockCountPhoto {
  id: string;
  stockCountItemId: string;
  fileName: string;
  dateCreated: string;
}

export interface SilaShortageFilter {
  /** yyyy-mm-dd; defaults to 30 days before `to`. */
  from?: string;
  /** yyyy-mm-dd; defaults to today. */
  to?: string;
  locationId?: string;
  /** Justification category, or NOT_JUSTIFIED. */
  category?: string;
  enquiryStatus?: string;
  /** PENDING | POSTED | FAILED | SKIPPED | UNKNOWN, or NOT_POSTED. */
  sapStatus?: string;
}

export interface SilaShortageTotals {
  lines: number;
  shortageQty: number;
  shortageValue: number;
  justifiedLines: number;
  justifiedValue: number;
  acceptedLines: number;
  acceptedValue: number;
  rejectedLines: number;
  rejectedValue: number;
  postedLines: number;
  postedValue: number;
  /** Enquiry sent or more information required, waiting for the location. */
  awaitingValue?: number;
  /** Neither accepted nor rejected yet. */
  unresolvedValue?: number;
  /** Lines of counts the cost controller approved. */
  approvedValue?: number;
  sapPostedValue?: number;
  sapPendingValue?: number;
  sapFailedValue?: number;
  locations?: number;
  materials?: number;
  currency?: string | null;
}

export interface SilaShortageGroup {
  key: string;
  name: string;
  lines: number;
  shortageQty: number;
  shortageValue: number;
  postedValue: number;
}

export interface SilaShortageLine {
  stockCountId: string;
  countNumber: string;
  countType: string;
  countStatus: string;
  locationId: string;
  locationName?: string | null;
  submittedOn?: string | null;
  approvedOn?: string | null;
  stockCountItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  uom: string;
  systemQty: number;
  countedQty?: number | null;
  shortageQty: number;
  unitCost?: number | null;
  shortageValue: number;
  enquiryId?: string | null;
  enquiryNumber?: string | null;
  enquiryStatus?: string | null;
  justificationCategory?: string | null;
  response?: string | null;
  reviewStatus?: string | null;
  reviewComment?: string | null;
  posted: boolean;
  propertyName?: string | null;
  /** Manager(s) assigned to the count location. */
  manager?: string | null;
  sapStatus?: string | null;
  sapMaterialDocument?: string | null;
  sapError?: string | null;
}

/** Recipients and text of the shortage report email; the report filter decides the summary. */
export interface SilaShortageReportSend {
  toEmails: string[];
  ccEmails?: string[];
  subject?: string;
  message?: string;
  /** PDF, EXCEL or BOTH. The email service sends the summary; files stay as downloads. */
  attachment?: string;
}

export interface SilaShortageReportSendResult {
  recipients: number;
  sent: number;
  deliveryStatus?: string;
  note?: string | null;
}

export interface SilaShortageReport {
  from: string;
  to: string;
  totals: SilaShortageTotals;
  byLocation: SilaShortageGroup[];
  byReason: SilaShortageGroup[];
  totalLines: number;
  lines: SilaShortageLine[];
}

/** SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED */
export type SilaPhysicalInventoryStatus = string;

export interface SilaPhysicalInventory {
  id: string;
  requestNumber: string;
  locationId: string;
  locationName?: string | null;
  alertId?: string | null;
  alertTitle?: string | null;
  reason: string;
  scheduledDate: string;
  status: SilaPhysicalInventoryStatus;
  stockCountId?: string | null;
  countNumber?: string | null;
  countStatus?: string | null;
  requestedBy: string;
  assignedUserId?: string | null;
  dateCreated: string;
}

export interface SilaPhysicalInventoryWrite {
  locationId: string;
  reason: string;
  /** yyyy-mm-dd; empty picks a random working day within the next 7 days. */
  scheduledDate?: string | null;
}

export interface SilaAuditFilter {
  referenceType?: string;
  referenceId?: string;
  actor?: string;
  from?: string;
  to?: string;
}

export interface SilaAuditEvent {
  id: string;
  referenceType: string;
  referenceId: string;
  referenceNumber?: string | null;
  action: string;
  comment?: string | null;
  actorUserId: string;
  actorName?: string | null;
  dateCreated: string;
}

export interface SilaPage {
  index: number;
  limit: number;
}

const BASE = "/api/v1/buyer/sila";

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

/** Drops empty values so the backend applies its defaults. */
const params = (values: Record<string, string | number | undefined | null>): Record<string, string | number> => {
  const result: Record<string, string | number> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") result[key] = value;
  });
  return result;
};

const call = async <T>(request: () => Promise<{ data: T }>, fallback: string): Promise<T> => {
  try {
    return (await request()).data;
  } catch (error: unknown) {
    throw new Error(readError(error, fallback));
  }
};

/** A failed file request carries its JSON error inside a Blob. */
const readBlobError = async (error: unknown, fallback: string): Promise<string> => {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const data = JSON.parse(await error.response.data.text()) as { message?: string; description?: string };
      return data.description || data.message || fallback;
    } catch {
      return fallback;
    }
  }
  return readError(error, fallback);
};

const getBlob = async (url: string, query: Record<string, string | number>, fallback: string): Promise<Blob> => {
  try {
    const response = await axiosInstance.get<Blob>(url, { params: query, responseType: "blob" });
    return response.data;
  } catch (error: unknown) {
    throw new Error(await readBlobError(error, fallback));
  }
};

/** Saves a blob as a file in the browser. */
export const saveBlob = (blob: Blob, fileName: string): void => {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
};

// ---- Count line review and photos

export const reviewCountLine = (stockCountId: string, itemId: string, decision: SilaLineDecision, comment: string): Promise<unknown> =>
  call(
    () => axiosInstance.post(`${BASE}/stock-counts/${stockCountId}/items/${itemId}/review`, { decision, comment: comment.trim() || null }),
    "Could not save the review.",
  );

/** Uploads a JPEG or PNG photo (max 8 MB) of a count line. Used by the cloud count sheet and the mobile camera. */
export const addCountPhoto = async (stockCountId: string, itemId: string, file: File | Blob): Promise<SilaStockCountPhoto> => {
  const form = new FormData();
  form.append("file", file, file instanceof File ? file.name : "photo.jpg");
  return call(
    () => axiosInstance.post<SilaStockCountPhoto>(`${BASE}/stock-counts/${stockCountId}/items/${itemId}/photo`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
    "Could not upload the photo.",
  );
};

export const getCountPhoto = (stockCountId: string, photoId: string): Promise<Blob> =>
  getBlob(`${BASE}/stock-counts/${stockCountId}/photos/${photoId}`, {}, "Could not load the photo.");

// ---- Shortage report

const shortageParams = (filter: SilaShortageFilter): Record<string, string | number> =>
  params({
    from: filter.from,
    to: filter.to,
    locationId: filter.locationId,
    category: filter.category,
    enquiryStatus: filter.enquiryStatus,
    sapStatus: filter.sapStatus,
  });

export const getShortageReport = async (filter: SilaShortageFilter, page: SilaPage): Promise<SilaShortageReport> => {
  const data = await call(
    () => axiosInstance.get<SilaShortageReport>(`${BASE}/stock-counts/shortages`, { params: { ...shortageParams(filter), ...page } }),
    "Could not load the shortage report.",
  );
  return { ...data, byLocation: list(data.byLocation), byReason: list(data.byReason), lines: list(data.lines) };
};

/** Every line of the report (for the PDF), within the backend limit of 200 lines per call. */
export const getAllShortageLines = async (filter: SilaShortageFilter, total: number): Promise<SilaShortageLine[]> => {
  const lines: SilaShortageLine[] = [];
  for (let index = 0; index < total; index += 200) {
    const page = await getShortageReport(filter, { index, limit: 200 });
    lines.push(...page.lines);
    if (page.lines.length < 200) break;
  }
  return lines;
};

export const downloadShortageExcel = async (filter: SilaShortageFilter): Promise<void> => {
  const blob = await getBlob(`${BASE}/stock-counts/shortages/export`, shortageParams(filter), "Could not download the Excel file.");
  saveBlob(blob, `shortage-report-${filter.from ?? "start"}-${filter.to ?? "today"}.xlsx`);
};

// ---- Physical inventory

export const getPhysicalInventories = async (status: string, locationId: string, page: SilaPage): Promise<SilaPhysicalInventory[]> =>
  list(await call(
    () => axiosInstance.get<SilaPhysicalInventory[]>(`${BASE}/physical-inventory`, { params: { ...params({ status, locationId }), ...page } }),
    "Could not load the physical inventories.",
  ));

export const createPhysicalInventory = (request: SilaPhysicalInventoryWrite): Promise<SilaPhysicalInventory> =>
  call(
    () => axiosInstance.post<SilaPhysicalInventory>(`${BASE}/physical-inventory`, { ...request, scheduledDate: request.scheduledDate || null }),
    "Could not request the physical inventory.",
  );

export const reschedulePhysicalInventory = (requestId: string, scheduledDate: string | null): Promise<SilaPhysicalInventory> =>
  call(
    () => axiosInstance.put<SilaPhysicalInventory>(`${BASE}/physical-inventory/${requestId}/schedule`, { scheduledDate: scheduledDate || null }),
    "Could not reschedule the physical inventory.",
  );

export const cancelPhysicalInventory = (requestId: string, reason: string): Promise<unknown> =>
  call(
    () => axiosInstance.post(`${BASE}/physical-inventory/${requestId}/cancel`, { reason: reason.trim() || null }),
    "Could not cancel the physical inventory.",
  );

/** "Request physical inventory" on an alert: schedules a surprise blind count at the alert's location. */
export const requestAlertPhysicalInventory = (alertId: string): Promise<SilaPhysicalInventory> =>
  call(
    () => axiosInstance.post<SilaPhysicalInventory>(`${BASE}/alerts/${alertId}/request-count`, {}),
    "Could not request the physical inventory.",
  );

// ---- Audit log

export const getAuditLog = async (filter: SilaAuditFilter, page: SilaPage): Promise<SilaAuditEvent[]> =>
  list(await call(
    () => axiosInstance.get<SilaAuditEvent[]>(`${BASE}/audit`, {
      params: { ...params({ ...filter }), ...page },
    }),
    "Could not load the audit log.",
  ));

/** Emails the report summary of the filter to the recipients (no attachment). */
export const sendShortageReport = (filter: SilaShortageFilter, request: SilaShortageReportSend): Promise<SilaShortageReportSendResult> =>
  call(
    () =>
      axiosInstance.post<SilaShortageReportSendResult>(`${BASE}/stock-counts/shortages/send`, {
        ...filter,
        locationId: filter.locationId || null,
        from: filter.from || null,
        to: filter.to || null,
        category: filter.category || null,
        enquiryStatus: filter.enquiryStatus || null,
        sapStatus: filter.sapStatus || null,
        ...request,
      }),
    "Could not send the report.",
  );

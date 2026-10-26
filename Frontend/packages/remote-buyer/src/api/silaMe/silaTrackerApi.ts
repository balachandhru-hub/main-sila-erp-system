import axios from "axios";
import axiosInstance from "../axiosInstance";
import { readError } from "../readError";
import { composeLiveSilaMeTracker, reprocessLivePostings } from "./silaMeTrackerLive";

export type SilaTrackerName = "PURCHASING" | "SILA_ME";

export interface SilaTrackerSummary {
  total: number;
  processing: number;
  successful: number;
  failed: number;
  reprocessing: number;
  needsAttention: number;
}

export interface SilaTrackerRow {
  id: string;
  source: string;
  occurredOn: string;
  businessDate?: string | null;
  transactionType: string;
  dataClass: string;
  direction: string;
  companyCode?: string | null;
  propertyName?: string | null;
  plant?: string | null;
  storageLocation?: string | null;
  sourceSystem?: string | null;
  targetSystem?: string | null;
  businessReference?: string | null;
  userId?: string | null;
  receiveStatus: string;
  erpStatus: string;
  localStatus: string;
  overallStatus: string;
  retryCount: number;
  lastError?: string | null;
  erpReference?: string | null;
  erpHttpStatus?: number | null;
  integrationName?: string | null;
  action: string;
  reprocessFrom?: string | null;
  erpCallAllowed: boolean;
  posCode?: string | null;
  outletCode?: string | null;
  quantity?: number | null;
  uom?: string | null;
  recipeVersion?: number | null;
  movementType?: string | null;
  erpPostingId?: string | null;
}

export interface SilaTrackerAttempt {
  id: string;
  at: string;
  userId?: string | null;
  stage?: string | null;
  result?: string | null;
  previousError?: string | null;
  erpCalled: boolean;
  localCalled: boolean;
}

export interface SilaTrackerFlowStep {
  name: string;
  status: string;
  detail?: string | null;
  request?: string | null;
  response?: string | null;
}

export interface SilaInvoiceFlow {
  erpInvoiceId?: string | null;
  message?: string | null;
  steps: SilaTrackerFlowStep[];
}

export interface SilaTrackerDetail extends SilaTrackerRow {
  technicalDetail?: string | null;
  erpMessage?: string | null;
  localError?: string | null;
  localReference?: string | null;
  recipeId?: string | null;
  attempts: SilaTrackerAttempt[];
  flow?: SilaTrackerFlowStep[];
}

export interface SilaTrackerPage {
  total: number;
  summary: SilaTrackerSummary;
  rows: SilaTrackerRow[];
}

export interface SilaTrackerQuery {
  transactionType?: string;
  direction?: string;
  from?: string;
  to?: string;
  companyCode?: string;
  status?: string;
  userId?: string;
  plant?: string;
  storageLocation?: string;
  sourceSystem?: string;
  targetSystem?: string;
  dataClass?: string;
  search?: string;
  material?: string;
  integration?: string;
  stage?: string;
  index: number;
  limit: number;
}

export interface SilaTrackerReprocessResult {
  eligible: number;
  ineligible: number;
  completed: number;
  failed: number;
  messages: string[];
}

const trackerParams = (query: SilaTrackerQuery) => ({
  // Invoice posting rows are stored as reference type INVOICE. The connected tracker matches that value.
  transactionType: query.transactionType === "INVOICE_POSTING" ? "INVOICE" : query.transactionType || undefined,
  direction: query.direction || undefined,
  from: query.from || undefined,
  to: query.to || undefined,
  companyCode: query.companyCode || undefined,
  status: query.status || undefined,
  userId: query.userId || undefined,
  plant: query.plant || undefined,
  storageLocation: query.storageLocation || undefined,
  sourceSystem: query.sourceSystem || undefined,
  targetSystem: query.targetSystem || undefined,
  dataClass: query.dataClass || undefined,
  search: query.search || undefined,
  material: query.material || undefined,
  integration: query.integration || undefined,
  stage: query.stage || undefined,
  index: query.index,
  limit: query.limit,
});

const missing = (error: unknown): boolean => axios.isAxiosError(error) && error.response?.status === 404;

const annotateInvoiceRows = async (page: SilaTrackerPage): Promise<SilaTrackerPage> => {
  const ids = page.rows.map((row) => row.erpPostingId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return page;
  try {
    const response = await axiosInstance.post<{ results?: Array<{ id: string; erpInvoiceId?: string | null; message?: string | null }> }>(
      "/api/v1/buyer/sila/erp-postings/invoice-results",
      { ids },
    );
    const results = response.data?.results ?? [];
    if (results.length === 0) return page;
    const byId = new Map(results.map((item) => [item.id.toLowerCase(), item]));
    return {
      ...page,
      rows: page.rows.map((row) => {
        const found = row.erpPostingId ? byId.get(row.erpPostingId.toLowerCase()) : undefined;
        if (!found?.message) return row;
        return {
          ...row,
          lastError: found.message,
          erpReference: row.erpReference || found.erpInvoiceId || null,
        };
      }),
    };
  } catch {
    return page;
  }
};

export const getErpPostingFlow = async (postingId: string): Promise<SilaInvoiceFlow | null> => {
  try {
    const response = await axiosInstance.get<SilaInvoiceFlow>(`/api/v1/buyer/sila/erp-postings/${postingId}/flow`);
    return { ...response.data, steps: Array.isArray(response.data?.steps) ? response.data.steps : [] };
  } catch {
    return null;
  }
};

export const getTracker = async (tracker: SilaTrackerName, query: SilaTrackerQuery): Promise<SilaTrackerPage> => {
  try {
    const response = await axiosInstance.get<SilaTrackerPage>(`/api/v1/buyer/sila/trackers/${tracker}`, { params: trackerParams(query) });
    return annotateInvoiceRows(response.data);
  } catch (error) {
    if (tracker === "SILA_ME" && missing(error)) return annotateInvoiceRows(await composeLiveSilaMeTracker(query));
    throw new Error(readError(error, "Could not load the transaction tracker."));
  }
};

export const getTrackerDetail = async (tracker: SilaTrackerName, id: string): Promise<SilaTrackerDetail | null> => {
  try {
    const response = await axiosInstance.get<SilaTrackerDetail>(`/api/v1/buyer/sila/trackers/${tracker}/${encodeURIComponent(id)}`);
    return response.data;
  } catch (error) {
    if (missing(error)) return null;
    throw new Error(readError(error, "Could not open the transaction."));
  }
};

export const reprocessTracker = async (rows: Array<Pick<SilaTrackerRow, "id" | "erpPostingId">>): Promise<SilaTrackerReprocessResult> => {
  try {
    const response = await axiosInstance.post<SilaTrackerReprocessResult>("/api/v1/buyer/sila/trackers/reprocess", {
      ids: rows.map((row) => row.id),
    });
    return response.data;
  } catch (error) {
    if (missing(error)) return reprocessLivePostings(rows);
    throw new Error(readError(error, "Could not reprocess the transactions."));
  }
};

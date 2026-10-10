import axiosInstance from "../axiosInstance";
import { readError } from "../readError";
import type { SilaStockCountPhoto } from "./silaControlApi";

/** IN_PROGRESS | SUBMITTED | ENQUIRY_PENDING | POSTED | CANCELLED */
export type SilaStockCountStatus = string;

export type SilaCountType = "MONTHLY" | "PERIODIC" | "SURPRISE" | "ADHOC";

export type SilaCountMethod = "BARCODE" | "SEARCH" | "MANUAL" | "PHOTO";

export const SILA_COUNT_TYPES: SilaCountType[] = ["MONTHLY", "PERIODIC", "SURPRISE", "ADHOC"];

/** The justification categories the backend accepts, in display order. */
export const SILA_JUSTIFICATION_CATEGORIES: { value: string; label: string }[] = [
  { value: "BREAKAGE", label: "Breakage" },
  { value: "SPILLAGE", label: "Spillage" },
  { value: "UNRECORDED_CONSUMPTION", label: "Unrecorded consumption" },
  { value: "UNRECORDED_TRANSFER", label: "Unrecorded transfer" },
  { value: "COMPLIMENTARY_GUEST_RECOVERY", label: "Complimentary / guest recovery" },
  { value: "INCORRECT_PREVIOUS_COUNT", label: "Incorrect previous count" },
  { value: "POS_RECIPE_MAPPING_ISSUE", label: "POS / recipe mapping issue" },
  { value: "UOM_PACK_CONVERSION_ISSUE", label: "UOM / pack conversion issue" },
  { value: "EXPIRED_OR_SPOILED", label: "Expired / spoiled" },
  { value: "THEFT_SUSPECTED_LOSS", label: "Suspected loss" },
  { value: "OTHER", label: "Other" },
];

export interface SilaStockCountListItem {
  id: string;
  countNumber: string;
  locationId: string;
  locationName?: string | null;
  countType: string;
  blindCount: boolean;
  status: SilaStockCountStatus;
  totalItems: number;
  countedItems: number;
  shortageItems: number;
  surplusItems: number;
  dateCreated: string;
  submittedOn?: string | null;
  approvedOn?: string | null;
  propertyId?: string | null;
  propertyName?: string | null;
  /** yyyy-mm-ddT00:00:00; null on counts created before the business date existed. */
  businessDate?: string | null;
  /** 0 while a blind count hides the result. */
  matchedItems?: number;
  /** null while a blind count hides the result. */
  shortageValue?: number | null;
  currency?: string | null;
  createdBy?: string;
  createdByName?: string | null;
}

export interface SilaStockCountItem {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  barcode?: string | null;
  baseUom: string;
  /** Base unit first, then every unit the material converts from. */
  uoms: string[];
  /** null when hidden (blind count in progress). */
  systemQty?: number | null;
  countedQty?: number | null;
  varianceQty?: number | null;
  unitCost?: number | null;
  varianceValue?: number | null;
  countMethod?: string | null;
  /** NOT_COUNTED | MATCHED | SHORTAGE | SURPLUS, or COUNTED while a blind count hides the result. */
  status: string;
  countedBy?: string | null;
  countedOn?: string | null;
  /** The cost controller sent the line back to be counted again. */
  recountRequested?: boolean;
  /** ACCEPTED | REJECTED | MORE_INFORMATION_REQUIRED, null while not reviewed. */
  reviewStatus?: string | null;
  reviewComment?: string | null;
  enquiryId?: string | null;
  enquiryNumber?: string | null;
  enquiryStatus?: string | null;
  photos?: SilaStockCountPhoto[];
  countedByName?: string | null;
  /** Manager(s) assigned to the count location. */
  manager?: string | null;
  /** ERP posting of the variance: PENDING | POSTED | FAILED | SKIPPED | UNKNOWN; null when nothing is posted. */
  sapStatus?: string | null;
  sapMaterialDocument?: string | null;
  sapError?: string | null;
}

export interface SilaStockCountDetail {
  id: string;
  countNumber: string;
  locationId: string;
  locationName?: string | null;
  countType: string;
  blindCount: boolean;
  status: SilaStockCountStatus;
  notes?: string | null;
  canSeeSystemQty: boolean;
  totalItems: number;
  countedItems: number;
  remainingItems: number;
  matchedItems: number;
  shortageItems: number;
  surplusItems: number;
  shortageValue?: number | null;
  createdBy: string;
  dateCreated: string;
  submittedBy?: string | null;
  submittedOn?: string | null;
  approvedBy?: string | null;
  approvedOn?: string | null;
  items: SilaStockCountItem[];
  propertyId?: string | null;
  propertyName?: string | null;
  businessDate?: string | null;
  currency?: string | null;
  createdByName?: string | null;
  submittedByName?: string | null;
  approvedByName?: string | null;
}

export interface SilaStockCountWrite {
  locationId: string;
  countType: SilaCountType;
  blindCount: boolean;
  notes?: string | null;
  /** yyyy-mm-dd; today when empty. */
  businessDate?: string | null;
}

/** Full units plus optional open units in another unit, e.g. 2 BTL + 300 ML. */
export interface SilaStockCountItemWrite {
  /** Only when adding a material that is not on the count sheet. */
  materialId?: string | null;
  fullQty: number;
  fullUom?: string | null;
  openQty?: number | null;
  openUom?: string | null;
  method?: SilaCountMethod;
}

export interface SilaStockCountItemResult {
  item: SilaStockCountItem;
  message: string;
}

export interface SilaStockCountBarcode {
  materialId: string;
  materialCode: string;
  materialName: string;
  baseUom: string;
  /** null when the material is not on the count sheet yet. */
  item?: SilaStockCountItem | null;
}

export interface SilaStockCountTask {
  /** STOCK_COUNT | SHORTAGE_ENQUIRY */
  taskType: string;
  referenceId: string;
  stockCountId: string;
  number: string;
  locationName?: string | null;
  detail: string;
  status: string;
  dateCreated: string;
}

export interface SilaEnquiryEvent {
  action: string;
  comment?: string | null;
  actorUserId: string;
  dateCreated: string;
}

/** SENT | RESPONDED | MORE_INFORMATION_REQUIRED | ACCEPTED | REJECTED */
export type SilaEnquiryStatus = string;

export interface SilaEnquiry {
  id: string;
  enquiryNumber: string;
  stockCountId: string;
  countNumber?: string | null;
  stockCountItemId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  locationId: string;
  locationName?: string | null;
  systemQty?: number | null;
  physicalQty?: number | null;
  shortageQty: number;
  uom: string;
  assignedManagerUserId?: string | null;
  managerConfigured?: boolean;
  shortageValue?: number | null;
  status: SilaEnquiryStatus;
  justificationCategory?: string | null;
  response?: string | null;
  reviewComment?: string | null;
  respondedBy?: string | null;
  respondedOn?: string | null;
  reviewedBy?: string | null;
  reviewedOn?: string | null;
  dateCreated: string;
  events: SilaEnquiryEvent[];
}

/** NEW | ACKNOWLEDGED | RESOLVED | DISMISSED */
export type SilaAlertStatus = string;

export type SilaAlertAction = "acknowledge" | "resolve" | "dismiss";

export interface SilaAlert {
  id: string;
  /** LOW_STOCK | NEGATIVE_STOCK | INVENTORY_VARIANCE | TRANSFER_DISCREPANCY | POS_POSTING_FAILED */
  alertType: string;
  /** CRITICAL | HIGH | MEDIUM | INFO */
  severity: string;
  status: SilaAlertStatus;
  title: string;
  message: string;
  locationId?: string | null;
  locationName?: string | null;
  materialId?: string | null;
  materialCode?: string | null;
  materialName?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  recommendedAction?: string | null;
  dateCreated: string;
}

interface SuccessResponse {
  id: string;
  description?: string;
}

const BASE = "/api/v1/buyer/sila";

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const normalizeItem = (item: SilaStockCountItem): SilaStockCountItem => ({
  ...item,
  uoms: list(item.uoms).length > 0 ? list(item.uoms) : [item.baseUom],
  photos: list(item.photos),
});

const normalizeDetail = (detail: SilaStockCountDetail): SilaStockCountDetail => ({
  ...detail,
  items: list(detail.items).map(normalizeItem),
});

const optionalParams = (values: Record<string, string | number | undefined>): Record<string, string | number> | undefined => {
  const params: Record<string, string | number> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params[key] = value;
  });
  return Object.keys(params).length > 0 ? params : undefined;
};

export const getStockCounts = async (
  status?: string,
  locationId?: string,
  index = 0,
  limit = 200,
): Promise<SilaStockCountListItem[]> => {
  try {
    const response = await axiosInstance.get<SilaStockCountListItem[]>(`${BASE}/stock-counts`, {
      params: optionalParams({ status, locationId, index, limit }),
    });
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the stock counts."));
  }
};

/** Starts a count and returns its id. */
export const createStockCount = async (request: SilaStockCountWrite): Promise<string> => {
  try {
    const response = await axiosInstance.post<SuccessResponse>(`${BASE}/stock-counts`, request);
    return response.data.id;
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not start the stock count."));
  }
};

export const getStockCount = async (stockCountId: string): Promise<SilaStockCountDetail> => {
  try {
    const response = await axiosInstance.get<SilaStockCountDetail>(`${BASE}/stock-counts/${stockCountId}`);
    return normalizeDetail(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the stock count."));
  }
};

export const getStockCountTasks = async (): Promise<SilaStockCountTask[]> => {
  try {
    const response = await axiosInstance.get<SilaStockCountTask[]>(`${BASE}/stock-counts/tasks`);
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load your tasks."));
  }
};

/** Records the count of a line on the sheet. Inventory is not changed. */
export const countStockCountItem = async (
  stockCountId: string,
  itemId: string,
  request: SilaStockCountItemWrite,
): Promise<SilaStockCountItemResult> => {
  try {
    const response = await axiosInstance.put<SilaStockCountItemResult>(`${BASE}/stock-counts/${stockCountId}/items/${itemId}`, request);
    return { ...response.data, item: normalizeItem(response.data.item) };
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not save the count."));
  }
};

/** Counts a material that is not on the sheet yet (request.materialId is required). */
export const addStockCountItem = async (stockCountId: string, request: SilaStockCountItemWrite): Promise<SilaStockCountItemResult> => {
  try {
    const response = await axiosInstance.post<SilaStockCountItemResult>(`${BASE}/stock-counts/${stockCountId}/items`, request);
    return { ...response.data, item: normalizeItem(response.data.item) };
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not add the material to the count."));
  }
};

/** Finds the material of a scanned barcode (or a typed material code) and its line on the count. */
export const identifyBarcode = async (stockCountId: string, barcode: string): Promise<SilaStockCountBarcode> => {
  try {
    const response = await axiosInstance.get<SilaStockCountBarcode>(`${BASE}/stock-counts/${stockCountId}/identify-barcode`, {
      params: { barcode: barcode.trim() },
    });
    const data = response.data;
    return { ...data, item: data.item ? normalizeItem(data.item) : null };
  } catch (error: unknown) {
    throw new Error(readError(error, "BARCODE NOT MAPPED"));
  }
};

export interface SilaStockCountPhotoCandidate {
  materialId: string;
  materialCode: string;
  materialName: string;
  baseUom: string;
}

export interface SilaStockCountPhotoIdentify {
  configured: boolean;
  message: string;
  candidates: SilaStockCountPhotoCandidate[];
}

/** Asks for photo candidates. Does not select a material and does not change inventory. */
export const identifyStockCountPhoto = async (stockCountId: string): Promise<SilaStockCountPhotoIdentify> => {
  try {
    const response = await axiosInstance.post<SilaStockCountPhotoIdentify>(`${BASE}/stock-counts/${stockCountId}/identify-photo`);
    return { ...response.data, candidates: list(response.data.candidates) };
  } catch (error: unknown) {
    throw new Error(readError(error, "Photo identification is not available. Search the material."));
  }
};

export const submitStockCount = async (stockCountId: string, countMissingAsZero: boolean): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/stock-counts/${stockCountId}/submit`, { countMissingAsZero });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not submit the stock count."));
  }
};

export const approveStockCount = async (stockCountId: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/stock-counts/${stockCountId}/approve`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not approve the stock count."));
  }
};

export const cancelStockCount = async (stockCountId: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/stock-counts/${stockCountId}/cancel`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not cancel the stock count."));
  }
};

export const getEnquiries = async (status?: string, index = 0, limit = 200): Promise<SilaEnquiry[]> => {
  try {
    const response = await axiosInstance.get<SilaEnquiry[]>(`${BASE}/enquiries`, { params: optionalParams({ status, index, limit }) });
    return list(response.data).map((enquiry) => ({ ...enquiry, events: list(enquiry.events) }));
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the shortage enquiries."));
  }
};

export const getEnquiry = async (enquiryId: string): Promise<SilaEnquiry> => {
  try {
    const response = await axiosInstance.get<SilaEnquiry>(`${BASE}/enquiries/${enquiryId}`);
    return { ...response.data, events: list(response.data.events) };
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the shortage enquiry."));
  }
};

export const respondEnquiry = async (enquiryId: string, justificationCategory: string, responseText: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/enquiries/${enquiryId}/respond`, { justificationCategory, response: responseText });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not send the response."));
  }
};

export const reviewEnquiry = async (enquiryId: string, accept: boolean, comment: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/enquiries/${enquiryId}/review`, { accept, comment: comment.trim() || null });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not save the review."));
  }
};

export const getAlerts = async (status?: string, take?: number): Promise<SilaAlert[]> => {
  try {
    const response = await axiosInstance.get<SilaAlert[]>(`${BASE}/alerts`, { params: optionalParams({ status, take }) });
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the alerts."));
  }
};

export const updateAlert = async (alertId: string, action: SilaAlertAction): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/alerts/${alertId}/${action}`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not update the alert."));
  }
};

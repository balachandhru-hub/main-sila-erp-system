import axiosInstance from "../axiosInstance";
import { readError } from "../readError";

/* ---------- Inventory dashboard ---------- */

export interface SilaDashboardKpis {
  stockValue: number;
  lowStock: number;
  outOfStock: number;
  negativeStock: number;
  openTransfers: number;
  openCounts: number;
  openAlerts: number;
  /** Note per KPI; an unconfigured KPI shows "Not configured". */
  notes?: SilaDashboardKpiNote[];
}

export interface SilaDashboardKpiNote {
  /** STOCK_VALUE | LOW_STOCK | OUT_OF_STOCK | NEGATIVE_STOCK | OPEN_TRANSFERS | OPEN_COUNTS | OPEN_ALERTS */
  key: string;
  note: string;
  configured: boolean;
}

export interface SilaStockHealth {
  healthy: number;
  low: number;
  out: number;
  excess: number;
  /** False when no expiry-managed material is in stock. */
  nearExpiryConfigured?: boolean;
  nearExpiryNote?: string;
  expiryManagedInStock?: number;
}

/** An open alert in the action center. */
export interface SilaDashboardAction {
  alertId: string;
  alertType: string;
  severity: string;
  /** NEW | ACKNOWLEDGED */
  status: string;
  title: string;
  message: string;
  locationId?: string | null;
  locationName?: string | null;
  materialId?: string | null;
  materialCode?: string | null;
  /** REQUEST_TRANSFER | REQUEST_PHYSICAL_INVENTORY | INVESTIGATE | REVIEW_TRANSFER */
  recommendedAction?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  createdOn: string;
  kindLabel?: string;
  impact?: string | null;
  recommendation?: string | null;
  /** CREATE_TRANSFER | CREATE_PR | INVESTIGATE */
  primaryAction?: string;
  availableQty?: number | null;
  parLevel?: number | null;
  uom?: string | null;
  sourceLocationId?: string | null;
  sourceLocationName?: string | null;
  sourceAvailable?: number | null;
  /** Base-unit quantity to transfer or request. */
  recommendedQty?: number | null;
}

export interface SilaReplenishmentRow {
  materialId: string;
  materialCode: string;
  materialName: string;
  uom: string;
  destinationLocationId: string;
  destinationName: string;
  availableQty: number;
  reorderPoint?: number | null;
  minimumStock?: number | null;
  parLevel?: number | null;
  recommendedQty: number;
  sourceLocationId?: string | null;
  sourceName?: string | null;
  sourceTransferableQty?: number | null;
  /** CREATE_TRANSFER | CREATE_PR */
  action: string;
  openPurchaseRequestNumber?: string | null;
  /** OUT | LOW, or PR_OPEN */
  status?: string | null;
}

export interface SilaMovementBucket {
  key: string;
  label: string;
  count: number;
  value: number;
  note?: string;
  /** False when the data source is not set up (e.g. consumption without a POS source). */
  configured?: boolean;
}

export interface SilaTransferStage {
  status: string;
  count: number;
  label?: string;
  /** Transfer list tab: to-approve | in-transit | completed */
  tab?: string;
}

export interface SilaLocationValue {
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: string;
  value: number;
  sharePercent: number;
  /** The "Other locations" row. */
  aggregated?: boolean;
}

export interface SilaConsumptionRow {
  materialId: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  uom: string;
  value: number;
  /** The consuming location, or "N locations". */
  locationName?: string | null;
}

export interface SilaInventoryDashboard {
  currency?: string | null;
  /** Month whose stocking-level overrides were applied. */
  month: number;
  kpis: SilaDashboardKpis;
  health: SilaStockHealth;
  actions: SilaDashboardAction[];
  replenishment: SilaReplenishmentRow[];
  movementToday: SilaMovementBucket[];
  transferStages: SilaTransferStage[];
  valueByLocation: SilaLocationValue[];
  topConsumption: SilaConsumptionRow[];
}

export interface SilaDashboardFilter {
  propertyId?: string;
  /** A store or outlet, or a venue (its stores and outlets). */
  locationId?: string;
  /** STORE | OUTLET */
  locationType?: string;
  materialGroup?: string;
  /** yyyy-mm-dd; today when empty. */
  businessDate?: string;
}

export interface SilaReplenishmentLine {
  materialId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  /** Base unit. */
  quantity: number;
}

export interface SilaCreatedTransfer {
  id: string;
  itoNumber: string;
  fromLocationName?: string | null;
  toLocationName?: string | null;
  lineCount: number;
}

/* ---------- Purchase requests ---------- */

export const SILA_PR_STATUSES = ["SUBMITTED", "ADDED_TO_BUCKET", "CANCELLED"] as const;

/** LIVE_INVENTORY | REPLENISHMENT | ALERT | MANUAL */
export type SilaPurchaseRequestSource = "LIVE_INVENTORY" | "REPLENISHMENT" | "ALERT" | "MANUAL";

export interface SilaPurchaseRequest {
  id: string;
  requestNumber: string;
  locationId: string;
  locationName?: string | null;
  locationType?: string | null;
  materialId: string;
  materialCode?: string | null;
  materialName?: string | null;
  /** Base unit. */
  quantity: number;
  uom: string;
  reason?: string | null;
  status: string;
  source: string;
  requestedBy: string;
  requestedByName?: string | null;
  requestedOn: string;
  weeklyBucketId?: string | null;
  weeklyBucketCode?: string | null;
  /** The material is mapped to a catalog product. */
  catalogMapped: boolean;
}

export interface SilaPurchaseRequestWrite {
  locationId: string;
  materialId: string;
  quantity: number;
  /** Empty = the base unit. */
  uom?: string | null;
  reason?: string | null;
  source: SilaPurchaseRequestSource;
}

/* ---------- Quick-transfer policy ---------- */

export interface SilaQuickTransferPolicy {
  enabled: boolean;
  /** Largest quantity of one line (base unit); null = no limit. */
  maximumQuantity: number | null;
  skipManagerApproval: boolean;
  outletToOutletAllowed: boolean;
  sourceConfirmationRequired: boolean;
  /** Largest value (quantity x unit cost) of one quick transfer; null = no limit. */
  maximumValue?: number | null;
  /** The destination confirms the receipt; false posts the stock straight to the destination. */
  destinationConfirmationRequired?: boolean;
  /** Every quick transfer raises an alert for the source location. */
  managerNotification?: boolean;
  /** STORE / OUTLET; empty = all types. Cross-property quick transfers are never allowed. */
  allowedSourceTypes?: string[];
  allowedDestinationTypes?: string[];
}

/* ---------- Location Excel ---------- */

export interface SilaLocationImportRow {
  rowNumber: number;
  locationCode: string;
  locationName: string;
  locationType: string;
  /** NEW | UPDATE | UNCHANGED | INVALID */
  action: string;
  errors: string[];
}

export interface SilaLocationImportPreview {
  fileName: string;
  totalRows: number;
  newRows: number;
  updateRows: number;
  unchangedRows: number;
  invalidRows: number;
  fileErrors: string[];
  rows: SilaLocationImportRow[];
  imported: boolean;
}

/** Largest page the server returns. */
export const SILA_PAGE_LIMIT = 50;

const BASE = "/api/v1/buyer/sila";

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const call = async <T>(request: () => Promise<{ data: T }>, fallback: string): Promise<T> => {
  try {
    const response = await request();
    return response.data;
  } catch (error: unknown) {
    throw new Error(readError(error, fallback));
  }
};

export const getInventoryDashboard = async (filter: SilaDashboardFilter): Promise<SilaInventoryDashboard> => {
  const data = await call(
    () =>
      axiosInstance.get<SilaInventoryDashboard>(`${BASE}/inventory/dashboard`, {
        params: {
          propertyId: filter.propertyId || undefined,
          locationId: filter.locationId || undefined,
          locationType: filter.locationType || undefined,
          materialGroup: filter.materialGroup?.trim() || undefined,
          businessDate: filter.businessDate || undefined,
        },
      }),
    "Could not load the inventory dashboard.",
  );
  return {
    ...data,
    actions: list(data?.actions),
    replenishment: list(data?.replenishment),
    movementToday: list(data?.movementToday),
    transferStages: list(data?.transferStages),
    valueByLocation: list(data?.valueByLocation),
    topConsumption: list(data?.topConsumption),
  };
};

/** One STANDARD transfer per source → destination pair, reason "Replenishment". */
export const createReplenishmentTransfers = async (lines: SilaReplenishmentLine[]): Promise<SilaCreatedTransfer[]> => {
  const data = await call(
    () => axiosInstance.post<{ transfers: SilaCreatedTransfer[] }>(`${BASE}/inventory/replenishment`, { lines }),
    "Could not create the replenishment transfers.",
  );
  return list(data?.transfers);
};

export const getPurchaseRequests = async (status: string, index: number, limit = SILA_PAGE_LIMIT): Promise<SilaPurchaseRequest[]> =>
  list(
    await call(
      () => axiosInstance.get<SilaPurchaseRequest[]>(`${BASE}/purchase-requests`, { params: { status: status || undefined, index, limit } }),
      "Could not load the purchase requests.",
    ),
  );

export const createPurchaseRequest = (request: SilaPurchaseRequestWrite): Promise<SilaPurchaseRequest> =>
  call(() => axiosInstance.post<SilaPurchaseRequest>(`${BASE}/purchase-requests`, request), "Could not raise the purchase request.");

export const cancelPurchaseRequest = (requestId: string): Promise<unknown> =>
  call(() => axiosInstance.post(`${BASE}/purchase-requests/${requestId}/cancel`), "Could not cancel the purchase request.");

/** Adds the request to the current weekly bucket of its outlet; returns the bucket code. */
export const addPurchaseRequestToBucket = async (requestId: string, quantity?: number): Promise<string> => {
  const data = await call(
    () =>
      axiosInstance.post<{ bucketCode: string }>(`${BASE}/purchase-requests/${requestId}/add-to-bucket`, {
        quantity: quantity ?? null,
      }),
    "Could not add the request to the weekly bucket.",
  );
  return data?.bucketCode ?? "";
};

export const getQuickTransferPolicy = (): Promise<SilaQuickTransferPolicy> =>
  call(() => axiosInstance.get<SilaQuickTransferPolicy>(`${BASE}/quick-transfer-policy`), "Could not load the quick-transfer policy.");

export const saveQuickTransferPolicy = (policy: SilaQuickTransferPolicy): Promise<SilaQuickTransferPolicy> =>
  call(() => axiosInstance.put<SilaQuickTransferPolicy>(`${BASE}/quick-transfer-policy`, policy), "Could not save the quick-transfer policy.");

/** Downloads the location template or the export of the locations. */
export const downloadLocationExcel = async (kind: "template" | "export"): Promise<void> => {
  const blob = await call(
    () => axiosInstance.get<Blob>(`${BASE}/locations/excel/${kind}`, { responseType: "blob" }),
    kind === "template" ? "Could not download the template." : "Could not export the locations.",
  );
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = kind === "template" ? "location-template.xlsx" : `locations-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
};

const uploadLocations = async (step: "preview" | "import", file: File): Promise<SilaLocationImportPreview> => {
  const form = new FormData();
  form.append("file", file);
  const data = await call(
    () =>
      axiosInstance.post<SilaLocationImportPreview>(`${BASE}/locations/excel/${step}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
    step === "preview" ? "Could not check the file." : "Could not import the locations.",
  );
  return { ...data, rows: list(data?.rows), fileErrors: list(data?.fileErrors) };
};

/** Checks the file; nothing is saved. */
export const previewLocationImport = (file: File): Promise<SilaLocationImportPreview> => uploadLocations("preview", file);

/** Imports the file when every row is valid (all or nothing). */
export const importLocations = (file: File): Promise<SilaLocationImportPreview> => uploadLocations("import", file);

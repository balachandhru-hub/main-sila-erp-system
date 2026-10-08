import axios from "axios";
import axiosInstance from "../axiosInstance";
import { readError } from "../readError";

const BASE = "/api/v1/buyer/sila";

export interface SilaPriceChangeWrite {
  /** Price per price UOM, greater than zero. */
  unitPrice: number;
  currency: string | null;
  priceUom: string | null;
  /** yyyy-MM-dd */
  effectiveFrom: string | null;
  reason: string;
  /** Outlet the price is for; empty changes the default price used by outlets without their own. */
  outletLocationId?: string | null;
}

export interface SilaPriceApprovalStep {
  userId: string;
  name?: string | null;
  order: number;
  status: string;
  comment?: string | null;
  actedOn?: string | null;
}

export interface SilaPriceChange {
  id: string;
  requestNumber: string;
  materialId: string;
  materialCode: string;
  description: string;
  baseUom: string;
  currentUnitCost?: number | null;
  proposedUnitCost: number;
  currency?: string | null;
  priceUom?: string | null;
  /** Outlet the price is for; empty for the default price. */
  outletLocationId?: string | null;
  outletName?: string | null;
  effectiveFrom?: string | null;
  reason: string;
  /** PENDING_APPROVAL | APPROVED | REJECTED */
  status: string;
  requestedBy: string;
  requestedByName?: string | null;
  requestedOn: string;
  decidedOn?: string | null;
  currentLevel?: number | null;
  steps: SilaPriceApprovalStep[];
}

export interface SilaMaterialImportRow {
  sheet: string;
  rowNumber: number;
  materialCode: string;
  /** CHANGE | UNCHANGED | CONVERSION | INVALID */
  action: string;
  priceChange: boolean;
  messages: string[];
}

export interface SilaMaterialImportResult {
  fileName: string;
  applied: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  changedRows: number;
  unchangedRows: number;
  priceChanges: number;
  conversions: number;
  fileErrors: string[];
  rows: SilaMaterialImportRow[];
}

export interface SilaMaterialErpRoute {
  configured: boolean;
  companyCode?: string | null;
  configurationName?: string | null;
  systemName?: string | null;
  entityCode?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
}

export interface SilaMaterialErpPullResult {
  configurationName: string;
  read: number;
  new: number;
  changed: number;
  unchanged: number;
  failed: number;
  priceChanges: number;
  failures: string[];
}

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const call = async <T>(request: () => Promise<{ data: T }>, fallback: string): Promise<T> => {
  try {
    const response = await request();
    return response.data;
  } catch (error: unknown) {
    throw new Error(readError(error, fallback));
  }
};

/** A failed file download carries its JSON error inside a Blob. */
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

const download = async (url: string, params: Record<string, unknown>, fileName: string, fallback: string): Promise<void> => {
  try {
    const response = await axiosInstance.get<Blob>(url, { params, responseType: "blob" });
    const link = document.createElement("a");
    const href = URL.createObjectURL(response.data);
    link.href = href;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(href);
  } catch (error: unknown) {
    throw new Error(await readBlobError(error, fallback));
  }
};

export const submitPriceChange = (materialId: string, payload: SilaPriceChangeWrite): Promise<unknown> =>
  call(() => axiosInstance.post(`${BASE}/materials/${materialId}/price-changes`, payload), "Could not submit the price change.");

export const getPriceHistory = async (materialId: string, index = 0, limit = 20): Promise<SilaPriceChange[]> =>
  list(await call(
    () => axiosInstance.get<SilaPriceChange[]>(`${BASE}/materials/${materialId}/price-changes`, { params: { index, limit } }),
    "Could not load the price history.",
  ));

export const getPriceApprovals = async (index = 0, limit = 50): Promise<SilaPriceChange[]> =>
  list(await call(
    () => axiosInstance.get<SilaPriceChange[]>(`${BASE}/price-approvals`, { params: { index, limit } }),
    "Could not load the price approvals.",
  ));

export const decidePriceChange = (priceChangeId: string, approve: boolean, comment: string): Promise<unknown> =>
  call(
    () => axiosInstance.post(`${BASE}/price-approvals/${priceChangeId}/${approve ? "approve" : "reject"}`, { comment: comment.trim() || null }),
    approve ? "Could not approve the price change." : "Could not reject the price change.",
  );

export const downloadMaterialTemplate = (): Promise<void> =>
  download(`${BASE}/materials/excel/template`, {}, "material-template.xlsx", "Could not download the template.");

export const exportMaterials = (search: string, priceStatus: string, inventoryOnly: boolean): Promise<void> =>
  download(
    `${BASE}/materials/excel/export`,
    { search: search.trim() || undefined, priceStatus: priceStatus || undefined, inventoryOnly: inventoryOnly || undefined },
    "materials.xlsx",
    "Could not export the materials.",
  );

const upload = (path: string, file: File, fallback: string): Promise<SilaMaterialImportResult> => {
  const form = new FormData();
  form.append("file", file);
  return call(
    () => axiosInstance.post<SilaMaterialImportResult>(`${BASE}/materials/excel/${path}`, form, { headers: { "Content-Type": "multipart/form-data" } }),
    fallback,
  ).then((result) => ({ ...result, fileErrors: list(result.fileErrors), rows: list(result.rows) }));
};

/** Validates the file without saving anything. */
export const previewMaterialImport = (file: File): Promise<SilaMaterialImportResult> =>
  upload("preview", file, "Could not read the material file.");

/** Applies the file; nothing is saved unless every row is valid. */
export const confirmMaterialImport = (file: File): Promise<SilaMaterialImportResult> =>
  upload("import", file, "Could not import the material file.");

export const getMaterialErpRoute = (companyCode: string): Promise<SilaMaterialErpRoute> =>
  call(
    () => axiosInstance.get<SilaMaterialErpRoute>(`${BASE}/materials/erp-route`, { params: { companyCode: companyCode.trim() || undefined } }),
    "Could not load the ERP material API.",
  );

export const pullMaterialsFromErp = async (companyCode: string): Promise<SilaMaterialErpPullResult> => {
  const result = await call(
    () => axiosInstance.post<SilaMaterialErpPullResult>(`${BASE}/materials/erp-pull`, { companyCode: companyCode.trim() }),
    "Could not pull the materials from the ERP.",
  );
  return { ...result, failures: list(result.failures) };
};

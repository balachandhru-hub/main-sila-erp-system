import axiosInstance from "../axiosInstance";
import { readError } from "../readError";
import type { SilaPage } from "./silaReceivingApi";

/** ACTIVE | INACTIVE | BLOCKED */
export type SilaSupplierStatus = string;

export interface SilaSupplier {
  id: string;
  supplierCode: string;
  name: string;
  taxNumber?: string | null;
  aliases: string[];
  country?: string | null;
  status: SilaSupplierStatus;
  supplierOrganizationId?: string | null;
  updatedOn: string;
  /** Tax registration number (same as taxNumber). */
  trn?: string | null;
  legalName?: string | null;
  city?: string | null;
  address?: string | null;
  currency?: string | null;
  /** Status BLOCKED. */
  isBlocked?: boolean;
}

export interface SilaSupplierWrite {
  supplierCode: string;
  name: string;
  taxNumber?: string | null;
  aliases: string[];
  country?: string | null;
  status: SilaSupplierStatus;
  legalName?: string | null;
  city?: string | null;
  address?: string | null;
  currency?: string | null;
}

export interface SilaCompanyCode {
  id: string;
  code: string;
  name: string;
  country?: string | null;
  currency?: string | null;
  updatedOn: string;
  /** ACTIVE | INACTIVE (suspended) */
  status?: string;
}

export interface SilaCompanyCodeWrite {
  code: string;
  name: string;
  country?: string | null;
  currency?: string | null;
}

export interface SilaImportRow {
  rowNumber: number;
  key: string;
  /** NEW | UPDATE | UNCHANGED | INVALID */
  action: string;
  errors: string[];
}

/** A checked (preview) or imported Excel file. Imports are all-or-nothing. */
export interface SilaImportResult {
  fileName: string;
  committed: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newRows: number;
  updateRows: number;
  unchangedRows: number;
  rows: SilaImportRow[];
}

export interface SilaPullResult {
  apis: number;
  read: number;
  created: number;
  updated: number;
  unchanged: number;
  invalid: number;
  errors: string[];
}

export interface SilaOcrConfiguration {
  /** BUILT_IN | EXTERNAL */
  provider: string;
  autoExtractOnUpload: boolean;
  /** 0..1 */
  minimumConfidence: number;
  externalConfigured: boolean;
  saved: boolean;
  updatedOn?: string | null;
  /** Effective policy (defaults applied). */
  amountTolerance?: number;
  backendTimeoutSeconds?: number;
  backendRetryCount?: number;
  autoFallback?: boolean;
  alwaysBackendOnReread?: boolean;
  detailedLineExtraction?: boolean;
  supplierValidation?: boolean;
  poValidation?: boolean;
  financialReconciliation?: boolean;
  reuseCachedOcr?: boolean;
}

export interface SilaOcrConfigurationWrite {
  provider: string;
  autoExtractOnUpload: boolean;
  minimumConfidence: number;
  /** Omitted fields keep their saved value. */
  amountTolerance?: number;
  backendTimeoutSeconds?: number;
  backendRetryCount?: number;
  autoFallback?: boolean;
  alwaysBackendOnReread?: boolean;
  detailedLineExtraction?: boolean;
  supplierValidation?: boolean;
  poValidation?: boolean;
  financialReconciliation?: boolean;
  reuseCachedOcr?: boolean;
}

/** Which Excel file an import screen works with. */
export type SilaMasterFileKind = "suppliers" | "company-codes" | "purchase-orders";

const BASE = "/api/v1/buyer/sila";

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const call = async <T>(request: () => Promise<{ data: T }>, fallback: string): Promise<T> => {
  try {
    return (await request()).data;
  } catch (error: unknown) {
    throw new Error(readError(error, fallback));
  }
};

/** Saves a downloaded file under its name. */
const saveFile = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};

export const getSuppliers = async (search: string, status: string, page: SilaPage): Promise<SilaSupplier[]> =>
  list(await call(() => axiosInstance.get<SilaSupplier[]>(`${BASE}/suppliers`, {
    params: { search: search.trim() || undefined, status: status || undefined, ...page },
  }), "Could not load the suppliers.")).map((supplier) => ({ ...supplier, aliases: list(supplier.aliases) }));

/** One Supplier Master row (same fields as the list). */
export const getSupplier = async (supplierId: string): Promise<SilaSupplier> => {
  const data = await call(() => axiosInstance.get<SilaSupplier>(`${BASE}/suppliers/${supplierId}`), "Could not load the supplier.");
  return { ...data, aliases: list(data.aliases) };
};

export const createSupplier = async (request: SilaSupplierWrite): Promise<string> =>
  (await call(() => axiosInstance.post<{ id: string }>(`${BASE}/suppliers`, request), "Could not save the supplier.")).id;

export const updateSupplier = async (supplierId: string, request: SilaSupplierWrite): Promise<string> =>
  (await call(() => axiosInstance.put<{ id: string }>(`${BASE}/suppliers/${supplierId}`, request), "Could not save the supplier.")).id;

export const deleteSupplier = async (supplierId: string): Promise<void> => {
  await call(() => axiosInstance.delete(`${BASE}/suppliers/${supplierId}`), "Could not delete the supplier.");
};

/** Reads the suppliers of every active GET_SUPPLIER API into the Supplier Master. */
export const pullSuppliers = async (): Promise<SilaPullResult> => {
  const data = await call(() => axiosInstance.post<SilaPullResult>(`${BASE}/suppliers/pull`), "Could not read the suppliers from the ERP.");
  return { ...data, errors: list(data.errors) };
};

/** status: ACTIVE | INACTIVE; empty for both. */
export const getCompanyCodes = async (search: string, page: SilaPage, status = ""): Promise<SilaCompanyCode[]> =>
  list(await call(() => axiosInstance.get<SilaCompanyCode[]>(`${BASE}/company-codes`, {
    params: { search: search.trim() || undefined, status: status || undefined, ...page },
  }), "Could not load the company codes."));

export const createCompanyCode = async (request: SilaCompanyCodeWrite): Promise<string> =>
  (await call(() => axiosInstance.post<{ id: string }>(`${BASE}/company-codes`, request), "Could not save the company code.")).id;

export const updateCompanyCode = async (companyCodeId: string, request: SilaCompanyCodeWrite): Promise<string> =>
  (await call(() => axiosInstance.put<{ id: string }>(`${BASE}/company-codes/${companyCodeId}`, request), "Could not save the company code.")).id;

export const deleteCompanyCode = async (companyCodeId: string): Promise<void> => {
  await call(() => axiosInstance.delete(`${BASE}/company-codes/${companyCodeId}`), "Could not delete the company code.");
};

/** Reads the purchase orders of every active GET_PO API (source ERP). */
export const pullPurchaseOrders = async (): Promise<SilaPullResult> => {
  const data = await call(() => axiosInstance.post<SilaPullResult>(`${BASE}/purchase-orders/pull`), "Could not read the purchase orders from the ERP.");
  return { ...data, errors: list(data.errors) };
};

const FILE_PATHS: Record<SilaMasterFileKind, { template: string; export?: string; import: string; name: string }> = {
  suppliers: { template: "suppliers/template", export: "suppliers/export", import: "suppliers/import", name: "supplier-master" },
  "company-codes": { template: "company-codes/template", export: "company-codes/export", import: "company-codes/import", name: "company-codes" },
  "purchase-orders": { template: "purchase-orders/import/template", import: "purchase-orders/import", name: "purchase-order-import" },
};

/** Downloads the Excel template, or the export of every row. */
export const downloadMasterFile = async (kind: SilaMasterFileKind, template: boolean): Promise<void> => {
  const paths = FILE_PATHS[kind];
  const path = template || !paths.export ? paths.template : paths.export;
  const blob = await call(() => axiosInstance.get<Blob>(`${BASE}/${path}`, { responseType: "blob" }), "Could not download the file.");
  saveFile(blob, `${paths.name}${template ? "-template" : ""}.xlsx`);
};

/** Checks (commit false) or imports (commit true) an Excel file; an import writes nothing when a row is invalid. */
export const importMasterFile = async (kind: SilaMasterFileKind, file: File, commit: boolean): Promise<SilaImportResult> => {
  const form = new FormData();
  form.append("file", file);
  const path = `${BASE}/${FILE_PATHS[kind].import}${commit ? "" : "/preview"}`;
  const data = await call(() => axiosInstance.post<SilaImportResult>(path, form, {
    headers: { "Content-Type": "multipart/form-data" },
  }), commit ? "Could not import the file." : "Could not check the file.");
  return { ...data, rows: list(data.rows).map((row) => ({ ...row, errors: list(row.errors) })) };
};

export const getOcrConfiguration = async (): Promise<SilaOcrConfiguration> =>
  call(() => axiosInstance.get<SilaOcrConfiguration>(`${BASE}/ocr-configuration`), "Could not load the OCR settings.");

export const saveOcrConfiguration = async (request: SilaOcrConfigurationWrite): Promise<SilaOcrConfiguration> =>
  call(() => axiosInstance.put<SilaOcrConfiguration>(`${BASE}/ocr-configuration`, request), "Could not save the OCR settings.");

/** Suspends (INACTIVE) or activates (ACTIVE) a company code. */
export const setCompanyCodeStatus = async (companyCodeId: string, active: boolean): Promise<void> => {
  await call(
    () => axiosInstance.post(`${BASE}/company-codes/${companyCodeId}/${active ? "activate" : "suspend"}`),
    active ? "Could not activate the company code." : "Could not suspend the company code.",
  );
};

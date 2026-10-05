import axios from "axios";
import axiosInstance from "../axiosInstance";
import { readError } from "../readError";
import type { SilaUomConversion } from "./silaInventoryApi";
import type { SilaPriceStatus } from "./silaRecipeApi";

/** A material offered as a recipe ingredient. */
export interface SilaIngredientOption {
  id: string;
  materialCode: string;
  description: string;
  materialGroup?: string | null;
  /** Item Master product type. */
  category?: string | null;
  baseUom: string;
  unitCost?: number | null;
  currency?: string | null;
  priceStatus: SilaPriceStatus;
  conversions: SilaUomConversion[];
  /** Suppliers that delivered it on purchase orders. */
  suppliers: string[];
}

export interface SilaIngredientPage {
  items: SilaIngredientOption[];
  total: number;
  index: number;
  limit: number;
}

export interface SilaIngredientFacets {
  materialGroups: string[];
  categories: string[];
  suppliers: string[];
  /** Inventory types of the active materials (STOCK, NON_STOCK, SERVICE). */
  materialTypes: string[];
  /** Suppliers with id and code (supplier master) or name only (purchase orders). */
  supplierOptions: SilaIngredientSupplierOption[];
}

export interface SilaIngredientSupplierOption {
  id?: string | null;
  code?: string | null;
  name: string;
}

export interface SilaIngredientFilters {
  search?: string;
  materialGroup?: string;
  category?: string;
  supplier?: string;
  /** Inventory type. */
  materialType?: string;
  /** Supplier master id (takes the supplier's aliases into account). */
  supplierId?: string;
  index?: number;
  limit?: number;
}

/** NOT_READY | AWAITING_ME | FAILED_POS */
export interface SilaRecipeNextAction {
  kind: string;
  title: string;
  detail?: string | null;
  referenceId?: string | null;
}

export interface SilaRecipeDashboard {
  activeRecipes: number;
  draftRecipes: number;
  pendingMyApproval: number;
  pendingApprovalTotal: number;
  failedPosSales: number;
  consumptionPostedToday: number;
  /** Every recipe (any status). */
  totalRecipes?: number;
  /** Active Item Master materials. */
  materialCount?: number;
  nextActions: SilaRecipeNextAction[];
}

/** families | categories */
export type SilaRecipeMasterKind = "families" | "categories";

export interface SilaRecipeMaster {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  recipeCount: number;
  /** ACTIVE | INACTIVE */
  status?: string;
}

export interface SilaRecipeMasterWrite {
  code: string;
  name: string;
  description?: string | null;
}

export interface SilaImportError {
  sheet: string;
  row: number;
  message: string;
}

/** Preview of an Excel import (imported = false) or the result of the confirmed import. */
export interface SilaImportPreview {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  imported: boolean;
  errors: SilaImportError[];
}

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

const download = async (url: string, fileName: string, fallback: string): Promise<void> => {
  try {
    const response = await axiosInstance.get<Blob>(url, { responseType: "blob" });
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

const upload = async (url: string, file: File, fallback: string): Promise<SilaImportPreview> => {
  const form = new FormData();
  form.append("file", file);
  const result = await call(
    () => axiosInstance.post<SilaImportPreview>(url, form, { headers: { "Content-Type": "multipart/form-data" } }),
    fallback,
  );
  return { ...result, errors: list(result.errors) };
};

export const getRecipeDashboard = async (): Promise<SilaRecipeDashboard> => {
  const result = await call(() => axiosInstance.get<SilaRecipeDashboard>(`${BASE}/recipes/dashboard`), "Could not load the recipe dashboard.");
  return { ...result, nextActions: list(result.nextActions) };
};

export const searchIngredients = async (filters: SilaIngredientFilters): Promise<SilaIngredientPage> => {
  const params: Record<string, string | number> = { index: filters.index ?? 0, limit: filters.limit ?? 20 };
  if (filters.search?.trim()) params.search = filters.search.trim();
  if (filters.materialGroup) params.materialGroup = filters.materialGroup;
  if (filters.category) params.category = filters.category;
  if (filters.supplier) params.supplier = filters.supplier;
  if (filters.materialType) params.materialType = filters.materialType;
  if (filters.supplierId) params.supplierId = filters.supplierId;
  const result = await call(
    () => axiosInstance.get<SilaIngredientPage>(`${BASE}/recipes/ingredient-search`, { params }),
    "Could not search the materials.",
  );
  return {
    ...result,
    items: list(result.items).map((item) => ({ ...item, conversions: list(item.conversions), suppliers: list(item.suppliers) })),
  };
};

export const getIngredientFacets = async (): Promise<SilaIngredientFacets> => {
  const result = await call(() => axiosInstance.get<SilaIngredientFacets>(`${BASE}/recipes/ingredient-facets`), "Could not load the search filters.");
  return {
    materialGroups: list(result.materialGroups),
    categories: list(result.categories),
    suppliers: list(result.suppliers),
    materialTypes: list(result.materialTypes),
    supplierOptions: list(result.supplierOptions),
  };
};

export const downloadRecipeTemplate = (): Promise<void> =>
  download(`${BASE}/recipes/template`, "recipes-template.xlsx", "Could not download the template.");

export const exportRecipes = (): Promise<void> => download(`${BASE}/recipes/export`, "recipes.xlsx", "Could not export the recipes.");

/** Validates the recipe workbook without saving. */
export const previewRecipeImport = (file: File): Promise<SilaImportPreview> =>
  upload(`${BASE}/recipes/import/preview`, file, "Could not read the recipe file.");

/** Imports the recipe workbook (all or nothing). */
export const confirmRecipeImport = (file: File): Promise<SilaImportPreview> =>
  upload(`${BASE}/recipes/import`, file, "Could not import the recipe file.");

/** status: ACTIVE (default) | INACTIVE | ALL */
export const getRecipeMasters = async (kind: SilaRecipeMasterKind, search = "", status?: string): Promise<SilaRecipeMaster[]> => {
  const params: Record<string, string | number> = { index: 0, limit: 200 };
  if (search.trim()) params.search = search.trim();
  if (status) params.status = status;
  return list(await call(
    () => axiosInstance.get<SilaRecipeMaster[]>(`${BASE}/recipe-masters/${kind}`, { params }),
    kind === "families" ? "Could not load the families." : "Could not load the categories.",
  ));
};

export const saveRecipeMaster = (kind: SilaRecipeMasterKind, request: SilaRecipeMasterWrite, id?: string): Promise<unknown> =>
  call(
    () => (id
      ? axiosInstance.put(`${BASE}/recipe-masters/${kind}/${id}`, request)
      : axiosInstance.post(`${BASE}/recipe-masters/${kind}`, request)),
    "Could not save.",
  );

export const deleteRecipeMaster = (kind: SilaRecipeMasterKind, id: string): Promise<unknown> =>
  call(() => axiosInstance.delete(`${BASE}/recipe-masters/${kind}/${id}`), "Could not delete.");

export const downloadRecipeMasterTemplate = (kind: SilaRecipeMasterKind): Promise<void> =>
  download(`${BASE}/recipe-masters/${kind}/template`, `recipe-${kind}-template.xlsx`, "Could not download the template.");

export const exportRecipeMasters = (kind: SilaRecipeMasterKind): Promise<void> =>
  download(`${BASE}/recipe-masters/${kind}/export`, `recipe-${kind}.xlsx`, "Could not export.");

export const previewRecipeMasterImport = (kind: SilaRecipeMasterKind, file: File): Promise<SilaImportPreview> =>
  upload(`${BASE}/recipe-masters/${kind}/import/preview`, file, "Could not read the file.");

export const confirmRecipeMasterImport = (kind: SilaRecipeMasterKind, file: File): Promise<SilaImportPreview> =>
  upload(`${BASE}/recipe-masters/${kind}/import`, file, "Could not import the file.");

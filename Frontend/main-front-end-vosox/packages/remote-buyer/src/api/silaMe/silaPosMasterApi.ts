import axiosInstance from "../axiosInstance";
import { readError } from "../readError";

export const POS_SYSTEMS = ["OPERA", "MICROS", "SIMPHONY", "INFOR", "OTHER"] as const;
export const POS_INTEGRATION_KINDS = ["FILE", "API"] as const;

export interface SilaPosSource {
  id: string;
  name: string;
  /** OPERA | MICROS | SIMPHONY | INFOR | OTHER */
  posSystem: string;
  /** FILE | API */
  integrationKind: string;
  isDefault: boolean;
  outletMappingCount: number;
  itemMappingCount: number;
}

export interface SilaPosSourceWrite {
  name: string;
  posSystem: string;
  integrationKind: string;
  isDefault: boolean;
}

export interface SilaPosOutletMapping {
  id: string;
  posSourceId: string;
  posOutletCode: string;
  posOutletName?: string | null;
  outletLocationId: string;
  locationCode?: string | null;
  locationName?: string | null;
  propertyName?: string | null;
  plantCode?: string | null;
  storageLocationCode?: string | null;
  locationActive: boolean;
}

export interface SilaPosOutletMappingWrite {
  posOutletCode: string;
  posOutletName?: string | null;
  outletLocationId: string;
}

export interface SilaPosItemMapping {
  id: string;
  posSourceId: string;
  posItemCode: string;
  posItemDescription?: string | null;
  recipeId: string;
  recipeCode?: string | null;
  recipeName?: string | null;
  recipeStatus?: string | null;
  /** 0 = never approved: sales of this item fail until the recipe is approved. */
  recipeActiveVersion: number;
}

export interface SilaPosItemMappingWrite {
  posItemCode: string;
  posItemDescription?: string | null;
  recipeId: string;
}

export interface SilaPosPage<T> {
  items: T[];
  total: number;
  index: number;
  limit: number;
}

export interface SilaPosMappingImport {
  fileName: string;
  totalRows: number;
  newRows: number;
  changedRows: number;
  unchangedRows: number;
  invalidRows: number;
  imported: boolean;
  errors: { row: number; message: string }[];
}

/** OUTLETS | ITEMS */
export type SilaPosMappingKind = "OUTLETS" | "ITEMS";

/** A recipe offered in the item mapping picker. */
export interface SilaPosRecipeOption {
  id: string;
  recipeCode: string;
  name: string;
  status: string;
  posCode?: string | null;
}

const BASE = "/api/v1/buyer/sila/pos";

const call = async <T>(request: () => Promise<{ data: T }>, fallback: string): Promise<T> => {
  try {
    return (await request()).data;
  } catch (error: unknown) {
    throw new Error(readError(error, fallback));
  }
};

const page = <T>(value: SilaPosPage<T> | null | undefined): SilaPosPage<T> => ({
  items: Array.isArray(value?.items) ? value!.items : [],
  total: value?.total ?? 0,
  index: value?.index ?? 0,
  limit: value?.limit ?? 0,
});

export const getPosSources = async (): Promise<SilaPosSource[]> => {
  const data = await call(() => axiosInstance.get<SilaPosSource[]>(`${BASE}/sources`), "Could not load the POS sources.");
  return Array.isArray(data) ? data : [];
};

export const savePosSource = async (sourceId: string | null, request: SilaPosSourceWrite): Promise<void> => {
  await call(
    () => (sourceId ? axiosInstance.put(`${BASE}/sources/${sourceId}`, request) : axiosInstance.post(`${BASE}/sources`, request)),
    "Could not save the POS source.",
  );
};

export const deletePosSource = async (sourceId: string): Promise<void> => {
  await call(() => axiosInstance.delete(`${BASE}/sources/${sourceId}`), "Could not delete the POS source.");
};

export const getOutletMappings = async (sourceId: string, search: string, index: number, limit: number): Promise<SilaPosPage<SilaPosOutletMapping>> =>
  page(
    await call(
      () => axiosInstance.get<SilaPosPage<SilaPosOutletMapping>>(`${BASE}/sources/${sourceId}/outlets`, { params: { search: search.trim() || undefined, index, limit } }),
      "Could not load the outlet mappings.",
    ),
  );

export const saveOutletMapping = async (sourceId: string, mappingId: string | null, request: SilaPosOutletMappingWrite): Promise<void> => {
  await call(
    () =>
      mappingId
        ? axiosInstance.put(`${BASE}/sources/${sourceId}/outlets/${mappingId}`, request)
        : axiosInstance.post(`${BASE}/sources/${sourceId}/outlets`, request),
    "Could not save the outlet mapping.",
  );
};

export const deleteOutletMapping = async (sourceId: string, mappingId: string): Promise<void> => {
  await call(() => axiosInstance.delete(`${BASE}/sources/${sourceId}/outlets/${mappingId}`), "Could not delete the outlet mapping.");
};

export const getItemMappings = async (sourceId: string, search: string, index: number, limit: number): Promise<SilaPosPage<SilaPosItemMapping>> =>
  page(
    await call(
      () => axiosInstance.get<SilaPosPage<SilaPosItemMapping>>(`${BASE}/sources/${sourceId}/items`, { params: { search: search.trim() || undefined, index, limit } }),
      "Could not load the item mappings.",
    ),
  );

export const saveItemMapping = async (sourceId: string, mappingId: string | null, request: SilaPosItemMappingWrite): Promise<void> => {
  await call(
    () =>
      mappingId
        ? axiosInstance.put(`${BASE}/sources/${sourceId}/items/${mappingId}`, request)
        : axiosInstance.post(`${BASE}/sources/${sourceId}/items`, request),
    "Could not save the item mapping.",
  );
};

export const deleteItemMapping = async (sourceId: string, mappingId: string): Promise<void> => {
  await call(() => axiosInstance.delete(`${BASE}/sources/${sourceId}/items/${mappingId}`), "Could not delete the item mapping.");
};

/** confirm = false previews the file; confirm = true imports every row (refused while a row is invalid). */
export const importMappings = async (sourceId: string, kind: SilaPosMappingKind, file: File, confirm: boolean): Promise<SilaPosMappingImport> => {
  const form = new FormData();
  form.append("file", file);
  const path = kind === "OUTLETS" ? "outlets" : "items";
  const result = await call(
    () =>
      axiosInstance.post<SilaPosMappingImport>(`${BASE}/sources/${sourceId}/${path}/import`, form, {
        params: { confirm },
        headers: { "Content-Type": "multipart/form-data" },
      }),
    "Could not import the mappings.",
  );
  return { ...result, errors: Array.isArray(result.errors) ? result.errors : [] };
};

/** Downloads an Excel template: SALES, OUTLETS or ITEMS. */
export const downloadPosTemplate = async (kind: "SALES" | SilaPosMappingKind): Promise<void> => {
  const blob = await call(() => axiosInstance.get<Blob>(`${BASE}/templates/${kind}`, { responseType: "blob" }), "Could not download the template.");
  const names: Record<string, string> = {
    SALES: "pos-sales-template.xlsx",
    OUTLETS: "pos-outlet-mapping-template.xlsx",
    ITEMS: "pos-item-mapping-template.xlsx",
  };
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = names[kind];
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};

/** Recipes for the item mapping picker (accepts the recipe list as an array or as a page). */
export const searchPosRecipes = async (search: string): Promise<SilaPosRecipeOption[]> => {
  const data = await call(
    () =>
      axiosInstance.get<SilaPosRecipeOption[] | { items?: SilaPosRecipeOption[] }>("/api/v1/buyer/sila/recipes", {
        params: { search: search.trim() || undefined, index: 0, limit: 20 },
      }),
    "Could not load the recipes.",
  );
  const rows = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return rows.filter((recipe) => recipe.status !== "INACTIVE").slice(0, 20);
};

/** A recipe sold at a POS outlet with its menu price, costing and POS item mapping. */
export interface SilaPosOutletMenuItem {
  recipeId: string;
  recipeCode: string;
  name: string;
  posCode?: string | null;
  posItem?: string | null;
  activeVersion: number;
  menuPrice: number;
  currency?: string | null;
  costPerServing: number;
  costPercent?: number | null;
  marginPercent?: number | null;
  posItemMappingId?: string | null;
  posItemCode?: string | null;
  posItemDescription?: string | null;
  lastSaleDate?: string | null;
}

/** Recipes priced at the location of an outlet mapping (the outlet menu). */
export const getOutletMenuItems = async (
  sourceId: string,
  outletMappingId: string,
  search: string,
  index: number,
  limit: number,
): Promise<SilaPosPage<SilaPosOutletMenuItem>> =>
  page(
    await call(
      () => axiosInstance.get<SilaPosPage<SilaPosOutletMenuItem>>(`${BASE}/sources/${sourceId}/outlets/${outletMappingId}/menu-items`, {
        params: { search: search.trim() || undefined, index, limit },
      }),
      "Could not load the outlet menu.",
    ),
  );

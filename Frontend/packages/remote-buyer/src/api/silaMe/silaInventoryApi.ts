import axios from "axios";
import axiosInstance from "../axiosInstance";
import { readError } from "../readError";
import type { SilaAlert } from "./silaStockCountApi";

/** STORE | OUTLET | VENUE */
export type SilaLocationType = string;

/** A VENUE groups stores and outlets of a property and holds no stock. */
export const SILA_LOCATION_TYPES = ["STORE", "OUTLET", "VENUE"] as const;
export const SILA_STORE_CATEGORIES = ["BEVERAGE", "FOOD", "TOBACCO", "GENERAL"] as const;

export interface SilaLocation {
  id: string;
  locationCode: string;
  locationName: string;
  locationType: SilaLocationType;
  propertyId: string;
  propertyName: string;
  outletId?: string | null;
  outletName?: string | null;
  /** BEVERAGE | FOOD | TOBACCO | GENERAL, stores only. */
  storeCategory?: string | null;
  /** SAP storage location code. */
  storageLocationCode?: string | null;
  transferEnabled: boolean;
  salesEnabled: boolean;
  /** The VENUE the location sits in. */
  parentLocationId?: string | null;
  parentLocationName?: string | null;
  glAccount?: string | null;
  costCenter?: string | null;
  profitCenter?: string | null;
  /** Users assigned to the location directly. */
  userCount?: number;
  description?: string | null;
  inventoryEnabled?: boolean;
  consumptionEnabled?: boolean;
  /** ACTIVE | INACTIVE */
  status?: string;
  /** Company code of the property. */
  companyCode?: string | null;
}

export interface SilaLocationWrite {
  propertyId: string;
  locationCode: string;
  locationName: string;
  locationType: SilaLocationType;
  outletId: string | null;
  storeCategory: string | null;
  storageLocationCode: string | null;
  transferEnabled: boolean;
  salesEnabled: boolean;
  /** STORE / OUTLET only: a VENUE of the same property. */
  parentLocationId: string | null;
  glAccount: string | null;
  costCenter: string | null;
  profitCenter: string | null;
  /** Omit to keep the saved value. */
  description?: string | null;
  inventoryEnabled?: boolean | null;
  consumptionEnabled?: boolean | null;
}

export interface SilaUomConversion {
  /** Present on conversions read from the server. */
  id?: string;
  fromUom: string;
  toUom: string;
  /** 1 fromUom = factor toUom. */
  factor: number;
}

/** STOCK | NON_STOCK | SERVICE */
export const SILA_INVENTORY_TYPES = ["STOCK", "NON_STOCK", "SERVICE"] as const;

/** APPROVED | MISSING | PENDING_APPROVAL */
export const SILA_PRICE_STATUSES = ["APPROVED", "MISSING", "PENDING_APPROVAL"] as const;

export interface SilaMaterial {
  id: string;
  materialCode: string;
  description: string;
  materialGroup?: string | null;
  baseUom: string;
  /** Approved cost per base unit. */
  unitCost?: number | null;
  currency?: string | null;
  barcode?: string | null;
  isInventoryItem: boolean;
  inventoryType?: string | null;
  batchManaged?: boolean;
  expiryManaged?: boolean;
  shelfLifeDays?: number | null;
  serialManaged?: boolean;
  standardPrice?: number | null;
  movingAveragePrice?: number | null;
  /** APPROVED | MISSING | PENDING_APPROVAL */
  priceStatus?: string;
  pendingPriceChangeId?: string | null;
  proposedUnitCost?: number | null;
  proposedPriceUom?: string | null;
  conversions: SilaUomConversion[];
  /** ERP | ITEM_MASTER */
  source?: string;
  updatedAt?: string;
  /** Price unit of the last approved price (the base unit when none). */
  approvedPriceUom?: string | null;
  priceApprovedOn?: string | null;
  companyCode?: string | null;
  /** S (standard) | V (moving average) */
  priceControl?: string | null;
  valuationClass?: string | null;
  materialType?: string | null;
  category?: string | null;
  alternateUom?: string | null;
  orderUom?: string | null;
}

/** Inventory fields of a material; the unit price changes only through an approved price change. */
export interface SilaMaterialInventoryWrite {
  barcode: string | null;
  isInventoryItem: boolean;
  inventoryType: string | null;
  batchManaged: boolean;
  expiryManaged: boolean;
  shelfLifeDays: number | null;
  serialManaged: boolean;
  standardPrice: number | null;
  movingAveragePrice: number | null;
}

/** A stocking row of a location. */
export interface SilaLocationMaterial {
  materialId: string;
  materialCode: string;
  description: string;
  baseUom: string;
  minimumStock?: number | null;
  parLevel?: number | null;
  reorderPoint?: number | null;
  /** REGULAR | ON_DEMAND */
  stockingType?: string;
  maximumStock?: number | null;
  safetyStock?: number | null;
  active?: boolean;
  onHandQty: number;
  /** Month overrides of the minimum stock and reorder point. */
  monthlyThresholds?: SilaMonthlyThreshold[];
}

/** A month override of a stocking row (month 1 = January). */
export interface SilaMonthlyThreshold {
  month: number;
  minimumStock: number | null;
  reorderPoint: number | null;
}

export interface SilaLocationMaterialWrite {
  materialId: string;
  minimumStock: number | null;
  parLevel: number | null;
  reorderPoint: number | null;
  /** REGULAR | ON_DEMAND; omit to keep the saved type. */
  stockingType?: string | null;
  maximumStock?: number | null;
  safetyStock?: number | null;
  /** Omit to keep the saved month overrides; an empty list removes them. */
  monthlyThresholds?: SilaMonthlyThreshold[];
}

export interface SilaLiveInventoryRow {
  materialId: string;
  materialCode: string;
  description: string;
  baseUom: string;
  onHandQty: number;
  inTransitQty: number;
  locationCount: number;
}

export interface SilaLiveInventoryLocation {
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: SilaLocationType;
  propertyId: string;
  propertyName: string;
  onHandQty: number;
  inTransitQty: number;
  minimumStock?: number | null;
  transferEnabled: boolean;
  /** What this location can give to the current location. */
  transferableQty?: number;
  /** The caller works at this location. */
  isMine: boolean;
  lastMovementOn?: string | null;
  /** Plant code of the property. */
  propertyCode?: string | null;
  /** On open transfers out of this location not yet dispatched. */
  reservedQty?: number;
  /** On hand minus reserved. */
  availableQty?: number;
  /** NEGATIVE | OUT | LOW | HEALTHY | EXCESS | IN_STOCK */
  stockStatus?: string;
  /** ACTIVE | INACTIVE | NOT_STOCKED */
  stockingStatus?: string;
  /** REGULAR | ON_DEMAND */
  stockingType?: string | null;
  transferableBasis?: string;
}

export interface SilaLiveInventoryDetail {
  materialId: string;
  materialCode: string;
  description: string;
  baseUom: string;
  unitCost?: number | null;
  currency?: string | null;
  onHandQty: number;
  inTransitQty: number;
  locations: SilaLiveInventoryLocation[];
  /** The location the recommendation is for. */
  currentLocationId?: string | null;
  requiredQty?: number;
  localAvailable?: number;
  shortage?: number;
  /** SUFFICIENT | REQUEST_TRANSFER | CREATE_PR | NO_LOCATION */
  recommendation?: string;
  recommendationReason?: string;
  /** REQUEST_TRANSFER | QUICK_TRANSFER | ADD_TO_LOCATION | ONE_TIME_TRANSFER | REDISTRIBUTE_STOCK | CREATE_PR | REQUEST_ITEM | REQUEST_PHYSICAL_INVENTORY */
  nextActions?: string[];
  bestSourceLocationId?: string | null;
  bestSourceName?: string | null;
  bestSourceTransferableQty?: number;
  /** STOCK | NON_STOCK | SERVICE */
  inventoryType?: string | null;
  inventoryItem?: boolean;
  batchManaged?: boolean;
  expiryManaged?: boolean;
  serialManaged?: boolean;
  /** The current location does not stock the material (no active stocking row). */
  notStockedAtLocation?: boolean;
  /** ACTIVE | INACTIVE | NOT_STOCKED at the current location. */
  localStockingStatus?: string | null;
  /** REDISTRIBUTE_STOCK target. */
  redistributeToLocationId?: string | null;
  redistributeToName?: string | null;
  redistributeQty?: number;
}

export interface SilaInventoryTransaction {
  id: string;
  transactionNumber: string;
  transactionType: string;
  /** IN | OUT */
  direction: string;
  locationId: string;
  locationCode?: string | null;
  locationName?: string | null;
  materialId: string;
  materialCode?: string | null;
  materialDescription?: string | null;
  /** Base quantity, always positive. */
  quantity: number;
  baseUom: string;
  enteredQuantity: number;
  enteredUom: string;
  unitCost?: number | null;
  value?: number | null;
  referenceType: string;
  referenceId: string;
  referenceNumber?: string | null;
  reason?: string | null;
  businessDate: string;
  dateCreated: string;
}

export interface SilaInventoryTransactionFilter {
  locationId?: string;
  materialId?: string;
  type?: string;
  /** yyyy-mm-dd */
  from?: string;
  /** yyyy-mm-dd */
  to?: string;
  index?: number;
  limit?: number;
}

export interface SilaInventoryHome {
  /** null when the caller has no location. */
  locationId?: string | null;
  locationCode?: string | null;
  locationName?: string | null;
  locationType?: string | null;
  propertyName?: string | null;
  pendingTransferApprovals: number;
  inTransitToReceive: number;
  openStockCounts: number;
  openEnquiries: number;
  openAlerts: number;
  lowStockItems: number;
}

/** The ledger's transaction types, for filters. */
export const SILA_TRANSACTION_TYPES = [
  "OPENING_STOCK",
  "GOODS_RECEIPT",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "GOODS_ISSUE_OUT",
  "GOODS_ISSUE_IN",
  "RECIPE_CONSUMPTION",
  "WASTE",
  "DAMAGE",
  "BREAKAGE",
  "SPOILAGE",
  "EXPIRED",
  "STOCK_COUNT_ADJUSTMENT",
  "MANUAL_ADJUSTMENT",
] as const;

/** Page size of the live inventory search. */
export const SILA_LIVE_PAGE_SIZE = 20;

const BASE = "/api/v1/buyer/sila";

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const normalizeMaterial = (material: SilaMaterial): SilaMaterial => ({
  ...material,
  conversions: list(material.conversions),
});

/** Locations the caller can work with (assigned, outlet locations of his outlets, or all for admin / store manager). */
export const getMyLocations = async (): Promise<SilaLocation[]> => {
  try {
    const response = await axiosInstance.get<SilaLocation[]>(`${BASE}/locations/mine`);
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load your locations."));
  }
};

/** All active locations of the organization. */
/** Active locations by default; status INACTIVE or ALL lists deactivated ones too. */
export const getLocations = async (status?: "ACTIVE" | "INACTIVE" | "ALL"): Promise<SilaLocation[]> => {
  try {
    const response = await axiosInstance.get<SilaLocation[]>(`${BASE}/locations`, { params: status ? { status } : undefined });
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the locations."));
  }
};

/** Item Master materials with their inventory fields, searched by code, description or barcode. */
export const searchMaterials = async (search: string): Promise<SilaMaterial[]> => {
  try {
    const response = await axiosInstance.get<SilaMaterial[]>(`${BASE}/materials`, {
      params: search.trim() ? { search: search.trim() } : undefined,
    });
    return list(response.data).map(normalizeMaterial);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the materials."));
  }
};

/** One page of Item Master materials; `index` is the row offset. */
export const getMaterialsPage = async (
  search: string,
  index: number,
  limit: number,
  inventoryOnly = false,
  priceStatus = "",
): Promise<SilaMaterial[]> => {
  try {
    const response = await axiosInstance.get<SilaMaterial[]>(`${BASE}/materials`, {
      params: {
        search: search.trim() || undefined,
        index,
        limit,
        inventoryOnly: inventoryOnly || undefined,
        priceStatus: priceStatus || undefined,
      },
    });
    return list(response.data).map(normalizeMaterial);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the materials."));
  }
};

export const createLocation = async (payload: SilaLocationWrite): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/locations`, payload);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not create the location."));
  }
};

export const updateLocation = async (locationId: string, payload: SilaLocationWrite): Promise<void> => {
  try {
    await axiosInstance.put(`${BASE}/locations/${locationId}`, payload);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not update the location."));
  }
};

/** Only a location without stock can be deactivated. */
export const deactivateLocation = async (locationId: string): Promise<void> => {
  try {
    await axiosInstance.delete(`${BASE}/locations/${locationId}`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not deactivate the location."));
  }
};

/** A user assigned to a location, with name and email from Identity (empty when Identity is unavailable). */
export interface SilaLocationUser {
  userId: string;
  name?: string | null;
  email?: string | null;
  roleName?: string | null;
}

export const getLocationUsers = async (locationId: string): Promise<SilaLocationUser[]> => {
  try {
    const response = await axiosInstance.get<{ locationId: string; userIds: string[]; users?: SilaLocationUser[] }>(
      `${BASE}/locations/${locationId}/users`,
    );
    const users = list(response.data?.users);
    return users.length > 0 ? users : list(response.data?.userIds).map((userId) => ({ userId }));
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the users of the location."));
  }
};

export const getLocationUserIds = async (locationId: string): Promise<string[]> => {
  try {
    const response = await axiosInstance.get<{ locationId: string; userIds: string[] }>(`${BASE}/locations/${locationId}/users`);
    return list(response.data?.userIds);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the users of the location."));
  }
};

/** Replaces the users assigned to the location. */
export const setLocationUsers = async (locationId: string, userIds: string[]): Promise<void> => {
  try {
    await axiosInstance.put(`${BASE}/locations/${locationId}/users`, { userIds });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not assign the users."));
  }
};

export const getLocationMaterials = async (locationId: string): Promise<SilaLocationMaterial[]> => {
  try {
    const response = await axiosInstance.get<SilaLocationMaterial[]>(`${BASE}/locations/${locationId}/materials`);
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the stocking levels."));
  }
};

/** Saves the full list of stocking rows; rows left out are removed. */
export const setLocationMaterials = async (locationId: string, items: SilaLocationMaterialWrite[]): Promise<void> => {
  try {
    await axiosInstance.put(`${BASE}/locations/${locationId}/materials`, { items });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not save the stocking levels."));
  }
};

export const updateMaterialInventory = async (materialId: string, payload: SilaMaterialInventoryWrite): Promise<void> => {
  try {
    await axiosInstance.put(`${BASE}/materials/${materialId}`, payload);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not update the material."));
  }
};

/** Adds or changes the conversion of a unit pair; one unit must be the base unit. */
export const saveMaterialConversion = async (materialId: string, conversion: SilaUomConversion): Promise<void> => {
  try {
    await axiosInstance.put(`${BASE}/materials/${materialId}/conversions`, {
      fromUom: conversion.fromUom,
      toUom: conversion.toUom,
      factor: conversion.factor,
    });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not save the conversion."));
  }
};

export const deleteMaterialConversion = async (materialId: string, conversionId: string): Promise<void> => {
  try {
    await axiosInstance.delete(`${BASE}/materials/${materialId}/conversions/${conversionId}`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not delete the conversion."));
  }
};

/** Needs a search of two characters or more, or a location. `index` is the row offset. */
export const searchLiveInventory = async (
  search: string,
  locationId: string | null,
  index = 0,
): Promise<SilaLiveInventoryRow[]> => {
  try {
    const response = await axiosInstance.get<SilaLiveInventoryRow[]>(`${BASE}/inventory/live`, {
      params: { search: search.trim() || undefined, locationId: locationId || undefined, index, limit: SILA_LIVE_PAGE_SIZE },
    });
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not search the inventory."));
  }
};

/**
 * The material's stock per location, within the properties of the caller's locations, and the recommendation for the
 * required quantity at the current location.
 */
export const getLiveInventoryDetail = async (
  materialId: string,
  options?: { requiredQty?: number; currentLocationId?: string },
): Promise<SilaLiveInventoryDetail> => {
  try {
    const response = await axiosInstance.get<SilaLiveInventoryDetail>(`${BASE}/inventory/live/${materialId}`, {
      params: {
        requiredQty: options?.requiredQty || undefined,
        currentLocationId: options?.currentLocationId || undefined,
      },
    });
    return { ...response.data, locations: list(response.data?.locations), nextActions: list(response.data?.nextActions) };
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the stock of the material."));
  }
};

export const getInventoryTransactions = async (filter: SilaInventoryTransactionFilter): Promise<SilaInventoryTransaction[]> => {
  try {
    const response = await axiosInstance.get<SilaInventoryTransaction[]>(`${BASE}/inventory/transactions`, {
      params: {
        locationId: filter.locationId || undefined,
        materialId: filter.materialId || undefined,
        type: filter.type || undefined,
        from: filter.from || undefined,
        to: filter.to || undefined,
        index: filter.index ?? 0,
        limit: filter.limit ?? 50,
      },
    });
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the inventory transactions."));
  }
};

/** The work waiting at the caller's location (the given one, otherwise the first). */
export const getInventoryHome = async (locationId?: string): Promise<SilaInventoryHome> => {
  try {
    const response = await axiosInstance.get<SilaInventoryHome>(`${BASE}/inventory/home`, {
      params: locationId ? { locationId } : undefined,
    });
    return response.data;
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the inventory summary."));
  }
};

/** The newest NEW alerts for the dashboard; null when the alerts endpoint is not available (404). */
export const getRecentAlerts = async (take = 5): Promise<SilaAlert[] | null> => {
  try {
    const response = await axiosInstance.get<SilaAlert[]>(`${BASE}/alerts`, { params: { status: "NEW", take } });
    return list(response.data);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw new Error(readError(error, "Could not load the alerts."));
  }
};

/** Readable label of an upper-case code, e.g. GOODS_ISSUE_OUT -> Goods issue out. */
export const silaLabel = (code: string | null | undefined): string => {
  if (!code) return "—";
  const text = code.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Quantity with up to 3 decimals. */
export const formatQty = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });

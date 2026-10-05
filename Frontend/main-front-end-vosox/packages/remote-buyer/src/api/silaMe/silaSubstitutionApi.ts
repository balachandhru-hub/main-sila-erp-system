import axios from "axios";
import axiosInstance from "../axiosInstance";
import { readError } from "../readError";

/** PROPOSED | ACCEPTED | DISMISSED */
export type SilaSubstitutionStatus = "PROPOSED" | "ACCEPTED" | "DISMISSED";

/** A system proposal to replace an ingredient that is short across the property with a material in stock. */
export interface SilaSubstitutionListItem {
  id: string;
  proposalNumber: string;
  status: SilaSubstitutionStatus;
  reason: string;
  recipeId: string;
  recipeCode: string;
  recipeName: string;
  ingredientMaterialId: string;
  ingredientCode: string;
  ingredientName: string;
  suggestedMaterialId: string;
  suggestedCode: string;
  suggestedName: string;
  locationId?: string | null;
  locationName?: string | null;
  propertyName?: string | null;
  /** The recipe version created when accepted. */
  createdVersion?: number | null;
  dateCreated?: string | null;
  decidedOn?: string | null;
}

export interface SilaSubstitutionPage {
  items: SilaSubstitutionListItem[];
  total: number;
  index: number;
  limit: number;
}

export interface SilaSubstitutionOutlet {
  outletLocationId: string;
  locationCode: string;
  locationName: string;
  menuPrice: number;
  currency?: string | null;
  costPercent?: number | null;
  marginPercent?: number | null;
}

/** An ingredient of the approved version with its stock across the property (base unit). */
export interface SilaSubstitutionIngredient {
  materialId?: string | null;
  subRecipeId?: string | null;
  itemCode: string;
  itemName: string;
  materialGroup?: string | null;
  quantity: number;
  uom: string;
  baseQuantity: number;
  baseUom: string;
  unitCost?: number | null;
  cost: number;
  sequence: number;
  propertyAvailableQty?: number | null;
  isShort: boolean;
}

/** A material in stock that can replace one short ingredient, with the line it becomes and the result if chosen. */
export interface SilaSubstitutionSuggestion {
  replacesMaterialId: string;
  materialId: string;
  materialCode: string;
  description: string;
  materialGroup?: string | null;
  baseUom: string;
  unitCost?: number | null;
  currency?: string | null;
  propertyAvailableQty: number;
  quantity: number;
  uom: string;
  baseQuantity: number;
  lineCost: number;
  costDelta: number;
  resultTotalCost: number;
  isRecommended: boolean;
  outlets: SilaSubstitutionOutlet[];
}

export interface SilaSubstitutionDetail {
  proposal: SilaSubstitutionListItem;
  recipeId: string;
  recipeCode: string;
  recipeName: string;
  itemMode: string;
  recipeStatus: string;
  activeVersion: number;
  latestVersion: number;
  /** A newer version is waiting for approval or being edited: the suggestion cannot be accepted now. */
  hasPendingVersion: boolean;
  currency?: string | null;
  totalCost: number;
  propertyId?: string | null;
  propertyName?: string | null;
  ingredients: SilaSubstitutionIngredient[];
  suggestions: SilaSubstitutionSuggestion[];
  outlets: SilaSubstitutionOutlet[];
}

export interface SilaSubstitutionReplacement {
  ingredientMaterialId: string;
  substituteMaterialId: string;
}

export interface SilaSubstitutionAcceptResult {
  proposalId: string;
  recipeId: string;
  recipeCode: string;
  version: number;
  proposalsClosed: number;
}

export interface SilaSubstitutionRunResult {
  buyers: number;
  recipesChecked: number;
  shortIngredients: number;
  created: number;
  updated: number;
  autoDismissed: number;
}

export interface SilaSubstitutionFilters {
  status?: SilaSubstitutionStatus | "";
  /** Zero-based page index. */
  index?: number;
  limit?: number;
}

const BASE = "/api/v1/buyer/sila/substitutions";

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

export const getSubstitutions = async (filters: SilaSubstitutionFilters = {}): Promise<SilaSubstitutionPage> => {
  try {
    const params: Record<string, string | number> = { index: filters.index ?? 0, limit: filters.limit ?? 50 };
    if (filters.status) params.status = filters.status;
    const response = await axiosInstance.get<SilaSubstitutionPage>(BASE, { params });
    return { ...response.data, items: list(response.data?.items) };
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the recipe change suggestions."));
  }
};

/** Open suggestions for task lists; null when the user may not see recipes (403) or the endpoint is missing (404). */
export const getOpenSubstitutionTasks = async (limit = 20): Promise<SilaSubstitutionListItem[] | null> => {
  try {
    const response = await axiosInstance.get<SilaSubstitutionPage>(BASE, { params: { status: "PROPOSED", index: 0, limit } });
    return list(response.data?.items);
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && (error.response?.status === 403 || error.response?.status === 404)) return null;
    throw new Error(readError(error, "Could not load the recipe change suggestions."));
  }
};

export const getSubstitution = async (proposalId: string): Promise<SilaSubstitutionDetail> => {
  try {
    const response = await axiosInstance.get<SilaSubstitutionDetail>(`${BASE}/${proposalId}`);
    const detail = response.data;
    return {
      ...detail,
      ingredients: list(detail.ingredients),
      outlets: list(detail.outlets),
      suggestions: list(detail.suggestions).map((item) => ({ ...item, outlets: list(item.outlets) })),
    };
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the suggestion."));
  }
};

/** Creates the next recipe version with the replacements and sends it for approval. */
export const acceptSubstitution = async (
  proposalId: string,
  replacements: SilaSubstitutionReplacement[],
): Promise<SilaSubstitutionAcceptResult> => {
  try {
    const response = await axiosInstance.post<SilaSubstitutionAcceptResult>(`${BASE}/${proposalId}/accept`, { replacements });
    return response.data;
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not send the changed recipe for approval."));
  }
};

export const dismissSubstitution = async (proposalId: string, reason: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/${proposalId}/dismiss`, { reason: reason.trim() });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not dismiss the suggestion."));
  }
};

/** Runs the shortage check for the organization now (it also runs every hour). */
export const generateSubstitutions = async (): Promise<SilaSubstitutionRunResult> => {
  try {
    const response = await axiosInstance.post<SilaSubstitutionRunResult>(`${BASE}/generate`);
    return response.data;
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not check the recipes for shortages."));
  }
};

/**
 * Cost and margin preview of the chosen replacements: the active total minus each replaced line plus its substitute line.
 * Returns the new total and the cost/margin percentages per outlet.
 */
export const previewSubstitution = (
  detail: SilaSubstitutionDetail,
  chosen: Record<string, SilaSubstitutionSuggestion>,
): { totalCost: number; outlets: SilaSubstitutionOutlet[] } => {
  const delta = Object.values(chosen).reduce((sum, item) => sum + item.costDelta, 0);
  const totalCost = detail.totalCost + delta;
  return {
    totalCost,
    outlets: detail.outlets.map((outlet) => ({
      ...outlet,
      costPercent: outlet.menuPrice > 0 ? (totalCost / outlet.menuPrice) * 100 : null,
      marginPercent: outlet.menuPrice > 0 ? ((outlet.menuPrice - totalCost) / outlet.menuPrice) * 100 : null,
    })),
  };
};

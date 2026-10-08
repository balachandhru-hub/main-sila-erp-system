import axiosInstance from "../axiosInstance";
import { readError } from "../readError";
import type { SilaUomConversion } from "./silaInventoryApi";

/** DIRECT (one material) | RECIPE (several materials) | BATCH (may contain another recipe). */
export type SilaRecipeMode = "DIRECT" | "RECIPE" | "BATCH";

/** DRAFT | PENDING_APPROVAL | APPROVED | REJECTED | INACTIVE */
export type SilaRecipeStatus = string;

/** APPROVED | MISSING | PENDING_APPROVAL */
export type SilaPriceStatus = string;

export interface SilaRecipeListItem {
  id: string;
  recipeCode: string;
  name: string;
  /** Category name (display). */
  category?: string | null;
  familyId?: string | null;
  familyName?: string | null;
  categoryId?: string | null;
  itemMode: SilaRecipeMode;
  servingQty: number;
  servingUom: string;
  sellingUom: string;
  posCode?: string | null;
  /** Status of the latest version. */
  status: SilaRecipeStatus;
  /** The latest version. */
  version: number;
  /** The approved version POS sales use; 0 when never approved. */
  activeVersion: number;
  /** The latest version has no readiness issue. */
  ready: boolean;
  issueCount: number;
  costComplete: boolean;
  /** Cost of the selling (active) version; of the latest version when nothing was approved yet. */
  totalCost: number;
  /** Cost of the pending version of an approved recipe; null when there is none. */
  draftTotalCost?: number | null;
  /** totalCost / servingQty. */
  costPerServing?: number;
  /** ACTIVE | INACTIVE | PENDING APPROVAL | READY FOR APPROVAL | NOT READY (n). */
  readinessStatus?: string;
  /** POS item description. */
  posItem?: string | null;
  /** Business date of the last POS sale consumed for the recipe. */
  lastSaleDate?: string | null;
  /** Approval list only: CREATE | CHANGE, the current level of the levels, its approver and role. */
  approvalEvent?: string | null;
  approvalLevel?: number | null;
  approvalLevelCount?: number | null;
  approverName?: string | null;
  approverRole?: string | null;
  currency?: string | null;
  ingredientCount: number;
  outletCount: number;
  submittedOn?: string | null;
  approvedOn?: string | null;
  dateUpdated?: string | null;
}

export interface SilaRecipePage {
  items: SilaRecipeListItem[];
  total: number;
  index: number;
  limit: number;
}

export interface SilaRecipeIngredient {
  id: string;
  /** Recipe code + -I1, -I2 ... */
  ingredientCode: string;
  materialId?: string | null;
  subRecipeId?: string | null;
  itemCode: string;
  itemName: string;
  quantity: number;
  uom: string;
  baseQuantity: number;
  baseUom: string;
  unitCost?: number | null;
  cost: number;
  sequence: number;
  /** Today's material price status; empty for a sub-recipe. */
  priceStatus?: SilaPriceStatus | null;
  currentUnitCost?: number | null;
  currency?: string | null;
  /** Outlet prices that replace currentUnitCost at those outlets. */
  outletPrices?: SilaMaterialOutletPrice[];
  /** Unit the price is per (the material's base unit). */
  priceUom?: string | null;
  /** Unit cost waiting for approval. */
  proposedUnitPrice?: number | null;
  /** "1 CS = 12 EA" */
  packSummary?: string | null;
  /** A material price change can be requested (none waiting). */
  canUpdatePrice?: boolean;
  conversions: SilaUomConversion[];
  /** Readiness problem of the line, e.g. "Price missing". */
  issue?: string | null;
}

/** The approved unit cost (per base unit) of a material at one outlet; it replaces the default price there. */
export interface SilaMaterialOutletPrice {
  outletLocationId: string;
  unitCost: number;
  currency?: string | null;
}

export interface SilaRecipeOutletPrice {
  id: string;
  outletLocationId: string;
  locationCode?: string | null;
  locationName?: string | null;
  menuPrice: number;
  currency?: string | null;
  /** Cost of one serving (recipe cost / serving qty). */
  costPerServing?: number;
  /** costPerServing / menuPrice x 100. */
  costPercent?: number | null;
  /** menuPrice - costPerServing. */
  marginAmount?: number | null;
  marginPercent?: number | null;
}

export interface SilaRecipeApprovalStep {
  userId: string;
  name?: string | null;
  email?: string | null;
  /** Approver's role. */
  roleName?: string | null;
  version: number;
  order: number;
  /** PENDING | APPROVED | REJECTED | CANCELLED */
  status: string;
  comment?: string | null;
  actedOn?: string | null;
}

export interface SilaRecipeEvent {
  action: string;
  comment?: string | null;
  actorUserId: string;
  actorName?: string | null;
  dateCreated: string;
}

export interface SilaRecipeVersion {
  version: number;
  /** ACTIVE | DRAFT | PENDING_APPROVAL | REJECTED | APPROVED | INACTIVE | SUPERSEDED */
  status: string;
}

export interface SilaRecipeReadiness {
  ready: boolean;
  costComplete: boolean;
  issues: string[];
  /** ACTIVE | INACTIVE | PENDING APPROVAL | READY FOR APPROVAL | NOT READY (n). */
  status?: string;
}

export interface SilaRecipeDetail
  extends Omit<SilaRecipeListItem, "ingredientCount" | "outletCount" | "dateUpdated" | "ready" | "issueCount" | "costComplete"> {
  description?: string | null;
  categoryName?: string | null;
  /** totalCost / servingQty of the shown version. */
  costPerServing?: number;
  /** The version shown. */
  viewVersion: number;
  /** Status of the version shown. */
  viewStatus: string;
  versions: SilaRecipeVersion[];
  readiness: SilaRecipeReadiness;
  submittedBy?: string | null;
  submittedByName?: string | null;
  /** The signed-in user is the approver whose turn it is. */
  canDecide: boolean;
  ingredients: SilaRecipeIngredient[];
  outletPrices: SilaRecipeOutletPrice[];
  /** Every version, newest first. */
  approvalSteps: SilaRecipeApprovalStep[];
  history: SilaRecipeEvent[];
}

export interface SilaRecipeIngredientWrite {
  materialId?: string | null;
  subRecipeId?: string | null;
  quantity: number;
  uom?: string | null;
}

export interface SilaRecipeOutletPriceWrite {
  outletLocationId: string;
  menuPrice: number;
  currency?: string | null;
}

export interface SilaRecipeWrite {
  name: string;
  description?: string | null;
  familyId?: string | null;
  categoryId?: string | null;
  itemMode: SilaRecipeMode;
  servingQty: number;
  servingUom: string;
  sellingUom?: string | null;
  posCode?: string | null;
  /** POS item description (display only). */
  posItem?: string | null;
  currency?: string | null;
  ingredients: SilaRecipeIngredientWrite[];
  outletPrices: SilaRecipeOutletPriceWrite[];
}

export interface SilaRecipeFilters {
  status?: string;
  itemMode?: string;
  search?: string;
  familyId?: string;
  categoryId?: string;
  /** Only recipes with an approved version that sells. */
  active?: boolean;
  index?: number;
  limit?: number;
}

interface SuccessResponse {
  id: string;
}

const BASE = "/api/v1/buyer/sila";

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const normalizeDetail = (detail: SilaRecipeDetail): SilaRecipeDetail => ({
  ...detail,
  versions: list(detail.versions),
  readiness: {
    ready: Boolean(detail.readiness?.ready),
    costComplete: Boolean(detail.readiness?.costComplete),
    issues: list(detail.readiness?.issues),
    status: detail.readiness?.status,
  },
  ingredients: list(detail.ingredients).map((ingredient) => ({ ...ingredient, conversions: list(ingredient.conversions) })),
  outletPrices: list(detail.outletPrices),
  approvalSteps: list(detail.approvalSteps),
  history: list(detail.history),
});

export const getRecipes = async (filters: SilaRecipeFilters = {}): Promise<SilaRecipePage> => {
  try {
    const params: Record<string, string | number | boolean> = { index: filters.index ?? 0, limit: filters.limit ?? 50 };
    if (filters.status) params.status = filters.status;
    if (filters.itemMode) params.itemMode = filters.itemMode;
    if (filters.search?.trim()) params.search = filters.search.trim();
    if (filters.familyId) params.familyId = filters.familyId;
    if (filters.categoryId) params.categoryId = filters.categoryId;
    if (filters.active) params.active = true;
    const response = await axiosInstance.get<SilaRecipePage>(`${BASE}/recipes`, { params });
    return { ...response.data, items: list(response.data?.items) };
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the recipes."));
  }
};

/** A recipe at a version (the latest when omitted). */
export const getRecipe = async (recipeId: string, version?: number): Promise<SilaRecipeDetail> => {
  try {
    const response = await axiosInstance.get<SilaRecipeDetail>(`${BASE}/recipes/${recipeId}`, {
      params: version ? { version } : undefined,
    });
    return normalizeDetail(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the recipe."));
  }
};

/** Creates a DRAFT recipe (version 1) and returns its id. */
export const createRecipe = async (request: SilaRecipeWrite): Promise<string> => {
  try {
    const response = await axiosInstance.post<SuccessResponse>(`${BASE}/recipes`, request);
    return response.data.id;
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not create the recipe."));
  }
};

/** Saves a recipe; an approved or rejected recipe becomes a new draft version (the active version keeps selling). */
export const updateRecipe = async (recipeId: string, request: SilaRecipeWrite): Promise<void> => {
  try {
    await axiosInstance.put(`${BASE}/recipes/${recipeId}`, request);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not save the recipe."));
  }
};

export const submitRecipe = async (recipeId: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/recipes/${recipeId}/submit`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not send the recipe for approval."));
  }
};

export const approveRecipe = async (recipeId: string, comment: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/recipes/${recipeId}/approve`, { comment: comment.trim() || null });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not approve the recipe."));
  }
};

export const rejectRecipe = async (recipeId: string, comment: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/recipes/${recipeId}/reject`, { comment: comment.trim() || null });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not reject the recipe."));
  }
};

export const deactivateRecipe = async (recipeId: string): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/recipes/${recipeId}/deactivate`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not deactivate the recipe."));
  }
};

/** Recipes whose current approval level is the signed-in user. */
export const getRecipeApprovals = async (): Promise<SilaRecipeListItem[]> => {
  try {
    const response = await axiosInstance.get<SilaRecipeListItem[]>(`${BASE}/recipe-approvals`);
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the recipes waiting for you."));
  }
};

export interface SilaApprovalWorkflowLevel {
  level: number;
  userId: string;
  name?: string | null;
  roleName?: string | null;
}

/** An active RECIPE approval flow with its scope and levels. */
export interface SilaApprovalWorkflow {
  id: string;
  code?: string | null;
  name?: string | null;
  /** ALL | PROPERTY | OUTLET | STORE | COMPANY_CODE */
  scopeKind?: string | null;
  scopeId?: string | null;
  scopeCode?: string | null;
  levelCount: number;
  levels: SilaApprovalWorkflowLevel[];
}

/** The RECIPE approval flows (workflow summary of the approvals page). */
export const getRecipeWorkflows = async (): Promise<SilaApprovalWorkflow[]> => {
  try {
    const response = await axiosInstance.get<SilaApprovalWorkflow[]>(`${BASE}/recipe-approvals/workflows`);
    return list(response.data).map((flow) => ({ ...flow, levels: list(flow.levels) }));
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the recipe approval workflows."));
  }
};

/** Units of measure for the serving UOM select: Item Master units, conversion units and serving defaults. */
export const getRecipeUoms = async (): Promise<string[]> => {
  try {
    const response = await axiosInstance.get<string[]>(`${BASE}/recipes/uoms`);
    return list(response.data);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the units of measure."));
  }
};

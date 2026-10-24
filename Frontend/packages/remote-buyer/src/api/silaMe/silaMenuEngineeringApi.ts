import axiosInstance from "../axiosInstance";
import { readError } from "../readError";
import type { SilaPurchaseRecommendationList } from "./silaInventoryControlApi";

const BASE = "/api/v1/buyer/sila/menu-engineering";

export interface MenuFilter {
  propertyId?: string;
  outletLocationId?: string;
  dateFrom?: string;
  dateTo?: string;
  mealPeriod?: string;
  category?: string;
  search?: string;
  status?: string;
  menuItemId?: string;
  menuPlanId?: string;
  index?: number;
  limit?: number;
}

export interface MenuEnvelope {
  view: string;
  dashboard?: MenuDashboard;
  items?: { items: MenuItemDetail[]; total: number; index: number; limit: number };
  item?: MenuItemDetail;
  plans?: { items: MenuPlanSummary[]; total: number };
  plan?: MenuPlanDetail;
  demand?: MenuDemand;
  posSales?: MenuPosSales;
  posMappings?: { items: MenuPosMapping[]; total: number };
  performance?: MenuPerformance;
  consumption?: MenuConsumption;
  costMargin?: { rows: MenuPerformanceRow[]; costDrivers: MenuInsight[] };
  requirements?: { rows: MenuRequirementRow[]; totalShortage: number };
  recommendations?: { menuDemand: MenuRequirementRow[]; existing: SilaPurchaseRecommendationList };
  intelligence?: { insights: MenuInsight[] };
  simulation?: MenuWhatIfResult;
  settings?: MenuSettings;
  lookups?: MenuLookups;
  savedId?: string;
  message?: string;
}

export interface MenuLookups {
  properties: { id: string; name: string; code?: string }[];
  outlets: { id: string; name: string; code?: string; propertyId?: string }[];
  mealPeriods: string[];
  categories: string[];
  recipes: { id: string; name: string; code?: string }[];
}

export interface MenuAttention {
  kind: string;
  title: string;
  message: string;
  priority: string;
  route?: string;
  menuItemId?: string;
  menuPlanId?: string;
  materialId?: string;
}

export interface MenuInsight {
  category: string;
  priority: string;
  title: string;
  reason: string;
  recommendedAction?: string;
  affectedName?: string;
  menuItemId?: string;
  materialId?: string;
}

export interface MenuDashboard {
  foodRevenue: number;
  foodCost: number;
  foodCostPercent?: number | null;
  grossMargin: number;
  averageCostPerPortion?: number | null;
  menuItemsSold: number;
  expectedCovers: number;
  plannedPortions: number;
  theoreticalConsumption: number;
  actualConsumption: number;
  consumptionVariance: number;
  varianceValue?: number | null;
  forecastShortage: number;
  purchaseRecommendationValue: number;
  stars: number;
  plowhorses: number;
  puzzles: number;
  dogs: number;
  missingRecipes: number;
  unmappedPos: number;
  missingCost: number;
  shortages: number;
  occupancySource?: string;
  occupancyFreshness?: string;
  occupancyPercent?: number | null;
  expectedGuests?: number | null;
  attention: MenuAttention[];
  insights: MenuInsight[];
  todayMenus: MenuPlanSummary[];
  topPerformers: MenuPerformanceRow[];
  shortIngredientRows: MenuRequirementRow[];
}

export interface MenuItemDetail {
  id?: string;
  menuItemCode: string;
  name: string;
  description?: string | null;
  category?: string | null;
  subCategory?: string | null;
  cuisine?: string | null;
  classification?: string | null;
  mealPeriods?: string | null;
  sellingPrice?: number | null;
  currency?: string | null;
  defaultPortionQty: number;
  portionUom?: string | null;
  adultPortionFactor?: number | null;
  childPortionFactor?: number | null;
  defaultParticipationRate?: number | null;
  defaultBufferPercentage?: number | null;
  serviceType?: string | null;
  dietaryTags?: string | null;
  allergenNotes?: string | null;
  imagePath?: string | null;
  propertyId?: string | null;
  outletLocationId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  status?: string | null;
  linkedRecipeId?: string | null;
  recipeLinkStatus?: string | null;
  recipeName?: string;
  recipeStatus?: string;
  recipeCost?: number | null;
  foodCostPercent?: number | null;
  contributionMargin?: number | null;
  costState?: string;
}

export interface MenuPlanSummary {
  id: string;
  planCode: string;
  name: string;
  propertyName?: string;
  outletName?: string;
  businessDate: string;
  mealPeriod?: string;
  expectedGuests?: number | null;
  expectedCovers?: number | null;
  status: string;
  lineCount: number;
  missingRecipes: number;
}

export interface MenuPlanLine {
  id?: string;
  menuItemId: string;
  menuItemName?: string;
  menuItemCode?: string;
  recipeLinkStatus?: string;
  participationRate?: number | null;
  bufferPercentage?: number | null;
  adultFactor?: number | null;
  childFactor?: number | null;
  recommendedPortions: number;
  plannedPortions?: number | null;
  portionsConfirmed?: boolean;
  confirmPortions?: boolean;
  overrideReason?: string | null;
  actualPortions?: number | null;
  variance?: number | null;
  warning?: string | null;
}

export interface MenuPlanDetail {
  id?: string;
  planCode: string;
  name: string;
  propertyId?: string | null;
  outletLocationId?: string | null;
  propertyName?: string;
  outletName?: string;
  businessDate: string;
  mealPeriod?: string | null;
  eventName?: string | null;
  expectedGuests?: number | null;
  expectedCovers?: number | null;
  mealParticipation?: number | null;
  status?: string;
  notes?: string | null;
  lines: MenuPlanLine[];
}

export interface MenuDemand {
  source: string;
  provider: string;
  status: string;
  freshness?: string;
  message?: string;
  occupancyPercent?: number | null;
  expectedGuests?: number | null;
  adults?: number | null;
  children?: number | null;
  arrivals?: number | null;
  departures?: number | null;
  stayovers?: number | null;
  roomsOccupied?: number | null;
  lastSuccessfulSync?: string | null;
  days: {
    businessDate: string;
    occupancyPercent?: number | null;
    expectedGuests?: number | null;
    expectedCovers?: number | null;
    recommendedPortions: number;
    plannedPortions: number;
    ingredientRequirement: number;
    availableInventory: number;
    openPoCoverage: number;
    shortage: number;
    source: string;
    freshness?: string;
  }[];
}

export interface MenuPosSales {
  qtySold: number;
  revenue: number;
  transactionCount: number;
  unmappedCount: number;
  lastSync?: string | null;
  syncStatus?: string;
  rows: {
    id: string;
    businessDate: string;
    posCode: string;
    quantity: number;
    amount?: number | null;
    menuItemName?: string | null;
    status: string;
  }[];
}

export interface MenuPosMapping {
  id: string;
  posCode: string;
  posDescription?: string | null;
  outletName?: string | null;
  menuItemId?: string | null;
  menuItemName?: string | null;
  suggestedMenuItemId?: string | null;
  suggestedMenuItemName?: string | null;
  suggestionConfidence?: number | null;
  status: string;
}

export interface MenuPerformanceRow {
  menuItemId: string;
  name: string;
  category?: string;
  qtySold: number;
  revenue: number;
  mixPercent: number;
  sellingPrice?: number | null;
  costPerPortion?: number | null;
  foodCostPercent?: number | null;
  contributionMargin?: number | null;
  marginPercent?: number | null;
  classification: string;
  costState: string;
}

export interface MenuPerformance {
  rows: MenuPerformanceRow[];
  stars: number;
  plowhorses: number;
  puzzles: number;
  dogs: number;
}

export interface MenuConsumption {
  rows: {
    materialName: string;
    menuItemName: string;
    uom: string;
    theoreticalQty: number;
    actualQty: number;
    varianceQty: number;
    variancePercent?: number | null;
    varianceValue?: number | null;
  }[];
  theoretical: number;
  actual: number;
  variance: number;
}

export interface MenuRequirementRow {
  materialId?: string;
  materialName: string;
  uom: string;
  requirement: number;
  available: number;
  openPo: number;
  netRequirement: number;
  shortage: number;
  reason: string;
  requiredDate?: string | null;
}

export interface MenuWhatIfResult {
  recommendedPortions: number;
  plannedPortions: number;
  ingredientRequirement: number;
  shortage: number;
  purchaseRequirement: number;
  foodCost: number;
  revenue: number;
  contributionMargin: number;
  marginPercent?: number | null;
  note: string;
}

export interface MenuSettings {
  defaultMealParticipation: number;
  defaultItemParticipation: number;
  defaultBufferPercentage: number;
  defaultAdultFactor: number;
  defaultChildFactor: number;
  popularityThreshold: number;
  highFoodCostPercent: number;
  staleHours: number;
  mealPeriods: string[];
  categories: string[];
  pmsProvider?: string;
  pmsConnectionName?: string;
  posConnectionName?: string;
  aiNotes?: string;
}

const qs = (filter: MenuFilter): string => {
  const params = new URLSearchParams();
  Object.entries(filter).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
};

export const getMenuEngineering = async (view: string, filter: MenuFilter = {}): Promise<MenuEnvelope> => {
  try {
    const extra = qs(filter);
    const { data } = await axiosInstance.get<MenuEnvelope>(`${BASE}?view=${encodeURIComponent(view)}${extra ? extra.replace("?", "&") : ""}`);
    return data;
  } catch (err) {
    throw new Error(readError(err));
  }
};

export const saveMenuEngineering = async (body: Record<string, unknown>): Promise<MenuEnvelope> => {
  try {
    const { data } = await axiosInstance.post<MenuEnvelope>(BASE, body);
    return data;
  } catch (err) {
    throw new Error(readError(err));
  }
};

export const simulateMenuEngineering = async (body: Record<string, unknown>): Promise<MenuEnvelope> => {
  try {
    const { data } = await axiosInstance.post<MenuEnvelope>(`${BASE}/simulate`, body);
    return data;
  } catch (err) {
    throw new Error(readError(err));
  }
};

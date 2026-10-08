import type { SilaUomConversion } from "../../../api/silaMe/silaInventoryApi";
import type { SilaMaterialOutletPrice, SilaRecipeDetail, SilaRecipeListItem, SilaRecipeMode } from "../../../api/silaMe/silaRecipeApi";
import type { SilaIngredientOption } from "../../../api/silaMe/silaRecipeToolsApi";
import { toBaseQuantity } from "./recipeFormat";

/** A material as the editor needs it: code, units, conversions and today's price. */
export interface IngredientMaterial {
  id: string;
  materialCode: string;
  description: string;
  baseUom: string;
  unitCost?: number | null;
  currency?: string | null;
  /** APPROVED | MISSING | PENDING_APPROVAL */
  priceStatus: string;
  /** Unit cost waiting for approval (saved lines only). */
  proposedUnitPrice?: number | null;
  /** Outlet prices that replace unitCost (the default price) at those outlets. */
  outletPrices?: SilaMaterialOutletPrice[];
  conversions: SilaUomConversion[];
}

export interface IngredientLine {
  key: string;
  /** Saved ingredient id (recipe code + I1, I2 ...); absent until the recipe is saved. */
  ingredientCode?: string;
  material?: IngredientMaterial;
  subRecipe?: SilaRecipeListItem;
  quantity: string;
  uom: string;
}

export interface HeaderValues {
  name: string;
  description: string;
  familyId: string;
  categoryId: string;
  itemMode: SilaRecipeMode;
  servingQty: string;
  servingUom: string;
  sellingUom: string;
  posCode: string;
  posItem: string;
  currency: string;
}

export interface LineCost {
  baseQuantity: number | null;
  baseUom: string;
  unitCost: number | null;
  currency?: string | null;
  /** APPROVED | MISSING | PENDING_APPROVAL at the costing outlet; empty for a sub-recipe. */
  priceStatus: string;
  /** null when the line cannot be costed (price not approved or no conversion). */
  cost: number | null;
  issue: string | null;
}

let lineSeed = 0;
export const nextKey = (): string => {
  lineSeed += 1;
  return `line-${lineSeed}`;
};

export const toNumber = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const headerFrom = (recipe?: SilaRecipeDetail | null): HeaderValues => ({
  name: recipe?.name ?? "",
  description: recipe?.description ?? "",
  familyId: recipe?.familyId ?? "",
  categoryId: recipe?.categoryId ?? "",
  itemMode: recipe?.itemMode ?? "RECIPE",
  servingQty: recipe ? String(recipe.servingQty) : "1",
  servingUom: recipe?.servingUom ?? "EA",
  sellingUom: recipe?.sellingUom ?? "EA",
  posCode: recipe?.posCode ?? "",
  posItem: recipe?.posItem ?? "",
  currency: recipe?.currency ?? "",
});

export const materialFromOption = (option: SilaIngredientOption): IngredientMaterial => ({
  id: option.id,
  materialCode: option.materialCode,
  description: option.description,
  baseUom: option.baseUom,
  unitCost: option.unitCost,
  currency: option.currency,
  priceStatus: option.priceStatus,
  outletPrices: option.outletPrices ?? [],
  conversions: option.conversions,
});

/** The editor lines of a saved version; sub-recipes must still be active (else they are dropped). */
export const linesFrom = (recipe: SilaRecipeDetail | null | undefined, activeRecipes: SilaRecipeListItem[]): IngredientLine[] =>
  (recipe?.ingredients ?? []).flatMap((ingredient): IngredientLine[] => {
    if (ingredient.materialId) {
      return [{
        key: nextKey(),
        material: {
          id: ingredient.materialId,
          materialCode: ingredient.itemCode,
          description: ingredient.itemName,
          baseUom: ingredient.baseUom,
          unitCost: ingredient.currentUnitCost,
          currency: ingredient.currency,
          priceStatus: ingredient.priceStatus ?? "MISSING",
          proposedUnitPrice: ingredient.proposedUnitPrice,
          outletPrices: ingredient.outletPrices ?? [],
          conversions: ingredient.conversions,
        },
        quantity: String(ingredient.quantity),
        uom: ingredient.uom,
        ingredientCode: ingredient.ingredientCode,
      }];
    }
    const sub = activeRecipes.find((x) => x.id.toLowerCase() === ingredient.subRecipeId?.toLowerCase());
    return sub
      ? [{ key: nextKey(), subRecipe: sub, quantity: String(ingredient.quantity), uom: sub.servingUom, ingredientCode: ingredient.ingredientCode }]
      : [];
  });

/** The unit cost (per base unit) of a material at an outlet: its outlet price, else the default price; null when neither is set. */
export const unitCostAt = (material: IngredientMaterial, outletId: string): { unitCost: number; currency: string | null } | null => {
  const own = outletId ? material.outletPrices?.find((price) => price.outletLocationId === outletId) : undefined;
  if (own && own.unitCost > 0) return { unitCost: own.unitCost, currency: own.currency ?? material.currency ?? null };
  return material.unitCost != null && material.unitCost > 0 ? { unitCost: material.unitCost, currency: material.currency ?? null } : null;
};

/**
 * Live cost of one line at an outlet ("" = the default price), costed only with a price and a known conversion
 * (as the server's readiness check).
 */
export const lineCost = (line: IngredientLine, outletId = ""): LineCost => {
  const quantity = toNumber(line.quantity);
  if (line.material) {
    const baseQuantity = toBaseQuantity(line.material, quantity, line.uom);
    const price = unitCostAt(line.material, outletId);
    const unitCost = price?.unitCost ?? null;
    const pending = line.material.priceStatus === "PENDING_APPROVAL";
    const priceStatus = pending ? "PENDING_APPROVAL" : price ? "APPROVED" : "MISSING";
    let issue: string | null = null;
    if (pending) issue = "Material price pending approval";
    else if (!price) issue = "Price missing";
    else if (baseQuantity == null) issue = `UOM conversion missing (${line.uom} to ${line.material.baseUom})`;
    return {
      baseQuantity,
      baseUom: line.material.baseUom,
      unitCost,
      currency: price?.currency ?? line.material.currency,
      priceStatus,
      cost: issue == null && baseQuantity != null ? baseQuantity * (unitCost ?? 0) : null,
      issue,
    };
  }
  if (line.subRecipe) {
    const perServing = line.subRecipe.servingQty > 0 ? line.subRecipe.totalCost / line.subRecipe.servingQty : 0;
    return { baseQuantity: quantity, baseUom: line.subRecipe.servingUom, unitCost: perServing, priceStatus: "", cost: perServing * quantity, issue: null };
  }
  return { baseQuantity: null, baseUom: "", unitCost: null, priceStatus: "", cost: null, issue: "Ingredient not found" };
};

/** Recipe cost at an outlet; null while any line cannot be costed there. */
export const totalCostAt = (lines: IngredientLine[], outletId: string): number | null => {
  if (lines.length === 0) return null;
  const costs = lines.map((line) => lineCost(line, outletId));
  return costs.every((cost) => cost.cost != null) ? costs.reduce((sum, cost) => sum + (cost.cost ?? 0), 0) : null;
};

/**
 * Readiness problem of a line, as the server: a material needs a price at every outlet the recipe is sold at (its outlet
 * price or else the default price); with no outlet priced yet the default price is used.
 */
const lineIssue = (line: IngredientLine, outletIds: string[]): string | null => {
  const base = lineCost(line, "").issue;
  if (base !== "Price missing" || outletIds.length === 0) return base;
  const missingAt = outletIds.filter((id) => lineCost(line, id).issue === "Price missing");
  return missingAt.length > 0 ? base : lineCost(line, outletIds[0]).issue;
};

/** Readiness issues of the editor content, the same rules as the server. `outletIds` are the outlets with a menu price. */
export const editorIssues = (lines: IngredientLine[], mode: SilaRecipeMode, outletIds: string[]): string[] => {
  const issues: string[] = [];
  if (lines.length === 0) issues.push("No ingredients");
  lines.forEach((line) => {
    const issue = lineIssue(line, outletIds);
    if (issue) {
      const code = line.material?.materialCode ?? line.subRecipe?.recipeCode ?? "";
      const name = line.material?.description ?? line.subRecipe?.name ?? "";
      issues.push(`${code} ${name}: ${issue}`);
    }
  });
  if (mode === "DIRECT" && lines.length !== 1) issues.push("A DIRECT item needs exactly one ingredient");
  if (outletIds.length === 0) issues.push("No outlet menu price");
  return issues;
};

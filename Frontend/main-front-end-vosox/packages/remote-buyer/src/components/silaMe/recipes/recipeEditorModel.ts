import type { SilaUomConversion } from "../../../api/silaMe/silaInventoryApi";
import type { SilaRecipeDetail, SilaRecipeListItem, SilaRecipeMode } from "../../../api/silaMe/silaRecipeApi";
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

/** Live cost of one line, costed only with an approved price and a known conversion (as the server's readiness check). */
export const lineCost = (line: IngredientLine): LineCost => {
  const quantity = toNumber(line.quantity);
  if (line.material) {
    const baseQuantity = toBaseQuantity(line.material, quantity, line.uom);
    const unitCost = line.material.unitCost ?? null;
    let issue: string | null = null;
    if (line.material.priceStatus === "PENDING_APPROVAL") issue = "Material price pending approval";
    else if (line.material.priceStatus !== "APPROVED") issue = "Price missing";
    else if (baseQuantity == null) issue = `UOM conversion missing (${line.uom} to ${line.material.baseUom})`;
    return {
      baseQuantity,
      baseUom: line.material.baseUom,
      unitCost,
      cost: issue == null && baseQuantity != null ? baseQuantity * (unitCost ?? 0) : null,
      issue,
    };
  }
  if (line.subRecipe) {
    const perServing = line.subRecipe.servingQty > 0 ? line.subRecipe.totalCost / line.subRecipe.servingQty : 0;
    return { baseQuantity: quantity, baseUom: line.subRecipe.servingUom, unitCost: perServing, cost: perServing * quantity, issue: null };
  }
  return { baseQuantity: null, baseUom: "", unitCost: null, cost: null, issue: "Ingredient not found" };
};

/** Readiness issues of the editor content, the same rules as the server. */
export const editorIssues = (lines: IngredientLine[], costs: LineCost[], mode: SilaRecipeMode, pricedOutlets: number): string[] => {
  const issues: string[] = [];
  if (lines.length === 0) issues.push("No ingredients");
  lines.forEach((line, index) => {
    const issue = costs[index]?.issue;
    if (issue) {
      const code = line.material?.materialCode ?? line.subRecipe?.recipeCode ?? "";
      const name = line.material?.description ?? line.subRecipe?.name ?? "";
      issues.push(`${code} ${name}: ${issue}`);
    }
  });
  if (mode === "DIRECT" && lines.length !== 1) issues.push("A DIRECT item needs exactly one ingredient");
  if (pricedOutlets === 0) issues.push("No outlet menu price");
  return issues;
};

import { searchLiveInventory } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { getRecipe, getRecipes, type SilaRecipeDetail } from '../../../../remote-buyer/src/api/silaMe/silaRecipeApi';

export interface RecipeSuggestion {
  id: string;
  code: string;
  name: string;
  canMake: boolean;
  detail: string;
}

const MAX_RECIPES = 6;
/** One stock lookup per material code. Enough for the recipes on the home screen. */
const MAX_CODES = 12;

/** Approved recipes first. Compares ingredients with stock at one location. */
export const loadRecipeSuggestions = async (locationId: string): Promise<RecipeSuggestion[]> => {
  const active = await getRecipes({ active: true, limit: MAX_RECIPES });
  const page = active.items.length > 0 ? active : await getRecipes({ limit: MAX_RECIPES });
  const details = (await Promise.all(page.items.slice(0, MAX_RECIPES).map((item) => getRecipe(item.id).catch(() => null))))
    .filter((detail): detail is SilaRecipeDetail => detail !== null);
  const codes: string[] = [];
  for (const detail of details) {
    for (const ingredient of detail.ingredients) {
      if (!ingredient.materialId || !ingredient.itemCode || codes.includes(ingredient.itemCode)) continue;
      if (codes.length >= MAX_CODES) break;
      codes.push(ingredient.itemCode);
    }
  }
  const checked = new Set(codes);
  const stockRows = await Promise.all(codes.map((code) => searchLiveInventory(code, locationId).catch(() => [])));
  const onHand = new Map<string, number>();
  stockRows.flat().forEach((row) => onHand.set(row.materialId.toLowerCase(), row.onHandQty));

  return details.map((detail) => {
    const materials = detail.ingredients.filter((ingredient) => ingredient.materialId);
    const unchecked = materials.filter((ingredient) => !checked.has(ingredient.itemCode));
    const missing = materials.filter((ingredient) => checked.has(ingredient.itemCode) && (onHand.get(ingredient.materialId!.toLowerCase()) ?? 0) <= 0);
    const canMake = materials.length > 0 && missing.length === 0 && unchecked.length === 0;
    const detailText = materials.length === 0
      ? 'No ingredients on this recipe'
      : canMake
        ? 'Ingredients are in stock at this location'
        : missing.length > 0
          ? `Short of ${missing.slice(0, 3).map((ingredient) => ingredient.itemCode).join(', ')}`
          : 'Not every ingredient was checked';
    return { id: detail.id, code: detail.recipeCode, name: detail.name, canMake, detail: detailText };
  });
};

using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The header of a recipe's pending version. Name, POS code, serving qty/UOM and selling UOM decide what POS sales match
    /// and consume, so once a recipe has an approved version those columns keep the active version's values; an edit writes
    /// the pending version's header into the Draft* columns, which are promoted on approval and cleared on rejection or
    /// deactivation. A recipe that was never approved (ActiveVersion 0) sells nothing and is edited in the main columns.
    /// </summary>
    public static partial class SilaRecipeRules
    {
        /// <summary>The recipe has a pending header (DraftServingQty is always set with it; DraftPosCode may be null).</summary>
        public static bool HasDraftHeader(Recipe recipe)
        {
            return recipe.DraftServingQty != null;
        }

        /// <summary>Name of the latest version (pending header when there is one).</summary>
        public static string LatestName(Recipe recipe)
        {
            return HasDraftHeader(recipe) ? recipe.DraftName ?? recipe.Name : recipe.Name;
        }

        /// <summary>POS code of the latest version (pending header when there is one; null there means no POS code).</summary>
        public static string? LatestPosCode(Recipe recipe)
        {
            return HasDraftHeader(recipe) ? recipe.DraftPosCode : recipe.PosCode;
        }

        public static decimal LatestServingQty(Recipe recipe)
        {
            return recipe.DraftServingQty ?? recipe.ServingQty;
        }

        public static string LatestServingUom(Recipe recipe)
        {
            return HasDraftHeader(recipe) ? recipe.DraftServingUom ?? recipe.ServingUom : recipe.ServingUom;
        }

        public static string LatestSellingUom(Recipe recipe)
        {
            return HasDraftHeader(recipe) ? recipe.DraftSellingUom ?? recipe.SellingUom : recipe.SellingUom;
        }

        /// <summary>Header of the shown version: the pending header for the pending version of an approved recipe, else the active one.</summary>
        public static bool ShowsDraftHeader(Recipe recipe, int version)
        {
            return HasDraftHeader(recipe) && version == recipe.Version && version != recipe.ActiveVersion;
        }

        /// <summary>
        /// Writes the header of the version being edited. With an approved version selling, the header goes to the Draft*
        /// columns and the active columns stay; a never-approved recipe is edited directly.
        /// </summary>
        private static void WriteHeader(Recipe recipe, string name, string? posCode, decimal servingQty, string servingUom, string sellingUom)
        {
            if (recipe.ActiveVersion > 0)
            {
                recipe.DraftName = name;
                recipe.DraftPosCode = posCode;
                recipe.DraftServingQty = servingQty;
                recipe.DraftServingUom = servingUom;
                recipe.DraftSellingUom = sellingUom;
                return;
            }

            recipe.Name = name;
            recipe.PosCode = posCode;
            recipe.ServingQty = servingQty;
            recipe.ServingUom = servingUom;
            recipe.SellingUom = sellingUom;
            ClearDraftHeader(recipe);
        }

        /// <summary>On final approval: the pending header becomes the active header.</summary>
        public static void PromoteDraftHeader(Recipe recipe)
        {
            if (recipe.DraftTotalCost != null)
            {
                recipe.TotalCost = recipe.DraftTotalCost.Value;
                recipe.DraftTotalCost = null;
            }

            if (!HasDraftHeader(recipe))
            {
                return;
            }

            recipe.Name = LatestName(recipe);
            recipe.PosCode = recipe.DraftPosCode;
            recipe.ServingQty = recipe.DraftServingQty!.Value;
            recipe.ServingUom = LatestServingUom(recipe);
            recipe.SellingUom = LatestSellingUom(recipe);
            ClearDraftHeader(recipe);
        }

        /// <summary>On rejection or deactivation: the pending header is dropped (the active header keeps selling).</summary>
        public static void ClearDraftHeader(Recipe recipe)
        {
            recipe.DraftName = null;
            recipe.DraftPosCode = null;
            recipe.DraftServingQty = null;
            recipe.DraftServingUom = null;
            recipe.DraftSellingUom = null;
            recipe.DraftTotalCost = null;
        }
    }
}

using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The rules of a recipe shared by its use cases. A recipe has versions: ingredient and outlet price rows carry the
    /// version they belong to. Recipe.Version is the latest version (the one Status describes) and Recipe.ActiveVersion
    /// the approved version POS sales consume (0 = never approved). Editing an approved recipe writes Version + 1 as a
    /// DRAFT while the active version keeps selling.
    /// </summary>
    public static partial class SilaRecipeRules
    {
        public const string EVENT_CREATED = "CREATED";
        public const string EVENT_UPDATED = "UPDATED";
        public const string EVENT_NEW_VERSION = "NEW_VERSION";
        public const string EVENT_SUBMITTED = "SUBMITTED";
        public const string EVENT_APPROVED = "APPROVED";
        public const string EVENT_REJECTED = "REJECTED";
        public const string EVENT_DEACTIVATED = "DEACTIVATED";

        public const string VERSION_ACTIVE = "ACTIVE";
        public const string VERSION_SUPERSEDED = "SUPERSEDED";

        public const string APPROVAL_EVENT_CREATE = "CREATE";
        public const string APPROVAL_EVENT_CHANGE = "CHANGE";

        public const string READINESS_ACTIVE = "ACTIVE";
        public const string READINESS_INACTIVE = "INACTIVE";
        public const string READINESS_PENDING = "PENDING APPROVAL";
        public const string READINESS_READY = "READY FOR APPROVAL";

        private const string DEFAULT_SELLING_UOM = "EA";
        private const int MAX_NAME = 200;
        private const int MAX_DESCRIPTION = 1000;
        private const int MAX_CODE = 50;
        private const int MAX_UOM = 20;
        private const int MAX_INGREDIENTS = 100;

        /// <summary>An active recipe of the buyer, tracked. Not found is a 404.</summary>
        public static async Task<Recipe> GetTrackedAsync(IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid recipeId)
        {
            Recipe? recipe = await repository.Recipe.FindFirstByConditionAsync(x => x.Id == recipeId && x.BuyerId == buyerId && x.IsActive);
            if (recipe == null)
            {
                logger.LogError($"Recipe not found. RecipeId: {recipeId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Recipe not found.", "Select a recipe of this organization.");
            }

            return recipe;
        }

        /// <summary>
        /// Starts a new draft version when the latest version is APPROVED or REJECTED. A version waiting for approval or an
        /// inactive recipe cannot be edited. Returns true when a new version was started.
        /// </summary>
        public static bool StartEditing(ILoggerManager logger, Recipe recipe, InventoryLedger ledger)
        {
            if (recipe.Status == Common.SILA_RECIPE_PENDING_APPROVAL)
            {
                logger.LogError($"Recipe is waiting for approval. RecipeId: {recipe.Id}");
                throw new BadRequestCustomException("Recipe is waiting for approval.", "Wait for the approvers to approve or reject it before editing.");
            }

            if (recipe.Status == Common.SILA_RECIPE_INACTIVE)
            {
                logger.LogError($"Recipe is inactive. RecipeId: {recipe.Id}");
                throw new BadRequestCustomException("Recipe is inactive.", "An inactive recipe cannot be edited. Create a new recipe instead.");
            }

            if (recipe.Status != Common.SILA_RECIPE_APPROVED && recipe.Status != Common.SILA_RECIPE_REJECTED)
            {
                return false;
            }

            string previous = recipe.Status;
            recipe.Status = Common.SILA_RECIPE_DRAFT;
            recipe.Version++;
            recipe.SubmittedBy = null;
            recipe.SubmittedOn = null;
            ledger.AddEvent(
                Common.SILA_REF_RECIPE,
                recipe.Id,
                EVENT_NEW_VERSION,
                recipe.ActiveVersion > 0
                    ? $"Version {recipe.Version} from {previous} version {recipe.Version - 1}. Version {recipe.ActiveVersion} keeps selling until it is approved."
                    : $"Version {recipe.Version} from {previous} version {recipe.Version - 1}.");
            return true;
        }

        /// <summary>
        /// Validates the request and writes it onto the recipe's latest version (Recipe.Version): header fields, a fresh set of
        /// ingredient and outlet price rows of that version (earlier rows of the same version are retired), and the total cost.
        /// Rows of other versions are untouched. An ingredient unit without conversion is saved (cost 0) and reported by the
        /// readiness check. The recipe code must already be set.
        /// </summary>
        public static async Task ApplyAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid buyerId,
            Guid userId,
            Guid roleId,
            Recipe recipe,
            SilaRecipeWriteDto request,
            CancellationToken cancellationToken)
        {
            string mode = ValidateHeader(logger, recipe.Id, request);
            List<SilaRecipeIngredientWriteDto> lines = request.Ingredients ?? new List<SilaRecipeIngredientWriteDto>();
            ValidateIngredientShape(logger, recipe.Id, mode, lines);

            string? posCode = string.IsNullOrWhiteSpace(request.PosCode) ? null : request.PosCode.Trim();
            await EnsurePosCodeFreeAsync(repository, logger, buyerId, recipe.Id, posCode, cancellationToken);
            await ApplyFamilyAndCategoryAsync(repository, logger, buyerId, recipe, request, cancellationToken);

            // Materials with their conversions, and the sub-recipes of a batch with their active cost per serving.
            List<Guid> materialIds = lines.Where(x => x.MaterialId != null).Select(x => x.MaterialId!.Value).ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = await SilaAccess.GetMaterialsAsync(repository, logger, buyerId, materialIds, cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(repository, materialIds, cancellationToken);
            Dictionary<Guid, (Recipe Recipe, decimal CostPerServing)> subRecipes = await GetSubRecipesAsync(repository, logger, buyerId, recipe.Id, lines, cancellationToken);

            List<SilaRecipeOutletPriceWriteDto> prices = request.OutletPrices ?? new List<SilaRecipeOutletPriceWriteDto>();
            Dictionary<Guid, InventoryLocation> outlets = await GetOutletLocationsAsync(repository, logger, buyerId, userId, roleId, recipe.Id, prices, cancellationToken);

            // Name, serving, selling UOM and POS code go to the Draft* columns while an approved version is selling.
            SilaInputRules.MaxLength(logger, request.PosItem, MAX_NAME, "POS item");
            recipe.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
            recipe.PosItem = string.IsNullOrWhiteSpace(request.PosItem) ? null : request.PosItem.Trim();
            recipe.ItemMode = mode;
            WriteHeader(
                recipe,
                request.Name.Trim(),
                posCode,
                request.ServingQty,
                request.ServingUom.Trim().ToUpperInvariant(),
                string.IsNullOrWhiteSpace(request.SellingUom) ? DEFAULT_SELLING_UOM : request.SellingUom.Trim().ToUpperInvariant());

            await RetireVersionRowsAsync(repository, recipe.Id, recipe.Version, cancellationToken);

            decimal totalCost = 0;
            int sequence = 0;
            foreach (SilaRecipeIngredientWriteDto line in lines)
            {
                sequence++;
                RecipeIngredient ingredient = new RecipeIngredient
                {
                    Id = Guid.NewGuid(),
                    RecipeId = recipe.Id,
                    Version = recipe.Version,
                    IngredientCode = $"{recipe.RecipeCode}-I{sequence}",
                    Quantity = line.Quantity,
                    Sequence = sequence,
                    IsActive = true
                };

                if (line.MaterialId != null)
                {
                    ItemBuyerMaster material = materials[line.MaterialId.Value];
                    string baseUom = UomConverter.BaseUomOf(material);
                    List<MaterialUomConversion> materialConversions = conversions.TryGetValue(material.Id, out List<MaterialUomConversion>? found)
                        ? found
                        : new List<MaterialUomConversion>();
                    ingredient.MaterialId = material.Id;
                    ingredient.ItemCode = material.MaterialCode ?? string.Empty;
                    ingredient.ItemName = material.Description ?? string.Empty;
                    ingredient.Uom = string.IsNullOrWhiteSpace(line.Uom) ? baseUom : line.Uom.Trim().ToUpperInvariant();
                    ingredient.BaseUom = baseUom;
                    ingredient.BaseQuantity = SilaRecipeReadiness.TryToBase(material, line.Quantity, ingredient.Uom, materialConversions) ?? 0;
                    ingredient.UnitCost = material.UnitCost;
                    ingredient.Cost = Math.Round(ingredient.BaseQuantity * (material.UnitCost ?? 0), 4);
                    recipe.Currency ??= material.Currency;
                }
                else
                {
                    (Recipe sub, decimal costPerServing) = subRecipes[line.SubRecipeId!.Value];
                    ingredient.SubRecipeId = sub.Id;
                    ingredient.ItemCode = sub.RecipeCode;
                    ingredient.ItemName = sub.Name;
                    ingredient.Uom = sub.ServingUom;
                    ingredient.BaseUom = sub.ServingUom;
                    ingredient.BaseQuantity = line.Quantity;
                    ingredient.UnitCost = costPerServing;
                    ingredient.Cost = Math.Round(line.Quantity * costPerServing, 4);
                }

                totalCost += ingredient.Cost;
                repository.RecipeIngredient.Create(ingredient);
            }

            if (!string.IsNullOrWhiteSpace(request.Currency))
            {
                recipe.Currency = request.Currency.Trim().ToUpperInvariant();
            }

            SetVersionCost(recipe, Math.Round(totalCost, 4));

            foreach (SilaRecipeOutletPriceWriteDto price in prices)
            {
                repository.RecipeOutletPrice.Create(new RecipeOutletPrice
                {
                    Id = Guid.NewGuid(),
                    RecipeId = recipe.Id,
                    Version = recipe.Version,
                    OutletLocationId = outlets[price.OutletLocationId].Id,
                    MenuPrice = price.MenuPrice,
                    Currency = string.IsNullOrWhiteSpace(price.Currency) ? recipe.Currency : price.Currency.Trim().ToUpperInvariant(),
                    IsActive = true
                });
            }
        }

        /// <summary>
        /// Cost of one serving: the recipe's total cost over its serving quantity (a batch for 5 is sold per plate).
        /// A serving quantity of zero or less is treated as one serving.
        /// </summary>
        public static decimal CostPerServing(decimal totalCost, decimal servingQty)
        {
            return servingQty > 0 ? Math.Round(totalCost / servingQty, 4) : totalCost;
        }

        /// <summary>Cost of one serving / menu price x 100; null without a menu price.</summary>
        public static decimal? CostPercent(decimal costPerServing, decimal menuPrice)
        {
            return menuPrice > 0 ? Math.Round(costPerServing / menuPrice * 100, 2) : null;
        }

        /// <summary>(Menu price - cost of one serving) / menu price x 100; null without a menu price.</summary>
        public static decimal? MarginPercent(decimal costPerServing, decimal menuPrice)
        {
            return menuPrice > 0 ? Math.Round((menuPrice - costPerServing) / menuPrice * 100, 2) : null;
        }

        /// <summary>Menu price - cost of one serving; null without a menu price.</summary>
        public static decimal? MarginAmount(decimal costPerServing, decimal menuPrice)
        {
            return menuPrice > 0 ? Math.Round(menuPrice - costPerServing, 4) : null;
        }

        /// <summary>
        /// Stores the cost of the version being edited: in DraftTotalCost while an approved version is selling (TotalCost
        /// keeps the selling version's cost), otherwise in TotalCost.
        /// </summary>
        public static void SetVersionCost(Recipe recipe, decimal totalCost)
        {
            if (recipe.ActiveVersion > 0 && recipe.Version != recipe.ActiveVersion)
            {
                recipe.DraftTotalCost = totalCost;
                return;
            }

            recipe.TotalCost = totalCost;
            recipe.DraftTotalCost = null;
        }

        /// <summary>
        /// Readiness label of a version: INACTIVE, ACTIVE (the selling version with no pending change), PENDING APPROVAL,
        /// READY FOR APPROVAL or NOT READY (n).
        /// </summary>
        public static string ReadinessStatus(Recipe recipe, int version, bool ready, int issueCount)
        {
            if (recipe.Status == Common.SILA_RECIPE_INACTIVE)
            {
                return READINESS_INACTIVE;
            }

            if (version == recipe.ActiveVersion)
            {
                return READINESS_ACTIVE;
            }

            if (version == recipe.Version && recipe.Status == Common.SILA_RECIPE_PENDING_APPROVAL)
            {
                return READINESS_PENDING;
            }

            return ready ? READINESS_READY : $"NOT READY ({issueCount})";
        }

        /// <summary>Status of one version: ACTIVE (selling), the recipe status for the latest version, otherwise SUPERSEDED.</summary>
        public static string VersionStatus(Recipe recipe, int version)
        {
            if (version == recipe.ActiveVersion && recipe.Status != Common.SILA_RECIPE_INACTIVE)
            {
                return VERSION_ACTIVE;
            }

            return version == recipe.Version ? recipe.Status : VERSION_SUPERSEDED;
        }

        /// <summary>V1..Vn with their status, newest first.</summary>
        public static List<SilaRecipeVersionDto> Versions(Recipe recipe)
        {
            List<SilaRecipeVersionDto> versions = new List<SilaRecipeVersionDto>();
            for (int version = recipe.Version; version >= 1; version--)
            {
                versions.Add(new SilaRecipeVersionDto { Version = version, Status = VersionStatus(recipe, version) });
            }

            return versions;
        }
    }
}

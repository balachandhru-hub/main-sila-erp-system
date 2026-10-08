using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>Validation and lookups of a recipe write.</summary>
    public static partial class SilaRecipeRules
    {
        /// <summary>Checks the header fields and returns the normalised item mode.</summary>
        private static string ValidateHeader(ILoggerManager logger, Guid recipeId, SilaRecipeWriteDto? request)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Name))
            {
                logger.LogError($"Recipe name is missing. RecipeId: {recipeId}");
                throw new BadRequestCustomException("Recipe name is required.", "Enter the name of the menu item.");
            }

            if (request.Name.Trim().Length > MAX_NAME || (request.Description?.Trim().Length ?? 0) > MAX_DESCRIPTION)
            {
                logger.LogError($"Recipe text too long. RecipeId: {recipeId}");
                throw new BadRequestCustomException("Text is too long.", $"Keep the name within {MAX_NAME} and the description within {MAX_DESCRIPTION} characters.");
            }

            if ((request.PosCode?.Trim().Length ?? 0) > MAX_CODE)
            {
                logger.LogError($"POS code too long. RecipeId: {recipeId}");
                throw new BadRequestCustomException("POS code is too long.", $"Use at most {MAX_CODE} characters.");
            }

            string mode = (request.ItemMode ?? string.Empty).Trim().ToUpperInvariant();
            if (mode != Common.SILA_RECIPE_DIRECT && mode != Common.SILA_RECIPE_RECIPE && mode != Common.SILA_RECIPE_BATCH)
            {
                logger.LogError($"Recipe mode is invalid. RecipeId: {recipeId}, ItemMode: {request.ItemMode}");
                throw new BadRequestCustomException("Item mode is invalid.", "Choose DIRECT, RECIPE or BATCH.");
            }

            if (request.ServingQty <= 0 || request.ServingQty > SilaInputRules.MAX_QUANTITY || string.IsNullOrWhiteSpace(request.ServingUom))
            {
                logger.LogError($"Recipe serving is invalid. RecipeId: {recipeId}, ServingQty: {request.ServingQty}");
                throw new BadRequestCustomException("Serving is required.", "Enter a serving quantity greater than zero and its unit.");
            }

            if (request.ServingUom.Trim().Length > MAX_UOM || (request.SellingUom?.Trim().Length ?? 0) > MAX_UOM)
            {
                logger.LogError($"Recipe unit too long. RecipeId: {recipeId}");
                throw new BadRequestCustomException("Unit is too long.", $"Use a unit code of at most {MAX_UOM} characters, e.g. EA, ML, KG.");
            }

            return mode;
        }

        private static void ValidateIngredientShape(ILoggerManager logger, Guid recipeId, string mode, List<SilaRecipeIngredientWriteDto> lines)
        {
            if (lines.Count == 0)
            {
                logger.LogError($"Recipe has no ingredient. RecipeId: {recipeId}");
                throw new BadRequestCustomException("Ingredients are required.", "Add at least one ingredient from the Item Master.");
            }

            if (lines.Count > MAX_INGREDIENTS)
            {
                logger.LogError($"Recipe has too many ingredients. RecipeId: {recipeId}, Count: {lines.Count}");
                throw new BadRequestCustomException("Too many ingredients.", $"A recipe has at most {MAX_INGREDIENTS} ingredients.");
            }

            foreach (SilaRecipeIngredientWriteDto line in lines)
            {
                if ((line.MaterialId == null) == (line.SubRecipeId == null))
                {
                    logger.LogError($"Ingredient needs one material or one sub-recipe. RecipeId: {recipeId}");
                    throw new BadRequestCustomException("Ingredient is invalid.", "Each ingredient is either a material or a sub-recipe.");
                }

                if (line.Quantity <= 0 || line.Quantity > SilaInputRules.MAX_QUANTITY)
                {
                    logger.LogError($"Ingredient quantity is not positive. RecipeId: {recipeId}, Quantity: {line.Quantity}");
                    throw new BadRequestCustomException("Ingredient quantity is invalid.", "Enter a quantity greater than zero for every ingredient.");
                }

                if ((line.Uom?.Trim().Length ?? 0) > MAX_UOM)
                {
                    logger.LogError($"Ingredient unit too long. RecipeId: {recipeId}");
                    throw new BadRequestCustomException("Ingredient unit is too long.", $"Use a unit code of at most {MAX_UOM} characters.");
                }

                if (line.SubRecipeId != null && mode != Common.SILA_RECIPE_BATCH)
                {
                    logger.LogError($"Sub-recipe outside a batch recipe. RecipeId: {recipeId}, ItemMode: {mode}");
                    throw new BadRequestCustomException("Sub-recipes need BATCH mode.", "Only a BATCH recipe can contain another recipe.");
                }
            }

            if (mode == Common.SILA_RECIPE_DIRECT && (lines.Count != 1 || lines[0].MaterialId == null))
            {
                logger.LogError($"Direct recipe needs exactly one material. RecipeId: {recipeId}, Ingredients: {lines.Count}");
                throw new BadRequestCustomException("A DIRECT item has exactly one material.", "Keep one material ingredient, or switch the mode to RECIPE.");
            }

            bool repeated = lines.Where(x => x.MaterialId != null).GroupBy(x => x.MaterialId).Any(x => x.Count() > 1)
                || lines.Where(x => x.SubRecipeId != null).GroupBy(x => x.SubRecipeId).Any(x => x.Count() > 1);
            if (repeated)
            {
                logger.LogError($"Ingredient repeated. RecipeId: {recipeId}");
                throw new BadRequestCustomException("Ingredient is repeated.", "Add each material or sub-recipe once and enter its total quantity.");
            }
        }

        private static async Task EnsurePosCodeFreeAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid recipeId, string? posCode, CancellationToken cancellationToken)
        {
            if (posCode == null)
            {
                return;
            }

            string upper = posCode.ToUpper();
            bool taken = await repository.Recipe
                .FindByCondition(x => x.BuyerId == buyerId
                    && x.IsActive
                    && x.Id != recipeId
                    && x.Status != Common.SILA_RECIPE_INACTIVE
                    && ((x.PosCode != null && x.PosCode.ToUpper() == upper)
                        || (x.DraftPosCode != null && x.DraftPosCode.ToUpper() == upper)))
                .AnyAsync(cancellationToken);
            if (taken)
            {
                logger.LogError($"POS code is used by another recipe. PosCode: {posCode}, BuyerId: {buyerId}");
                throw new ConflictCustomException(
                    "POS code is already used.",
                    $"Another active recipe has POS code {posCode} (selling or in a version waiting for approval). Use a different POS code.");
            }
        }

        /// <summary>Sets FamilyId / CategoryId (masters of the buyer) and writes the category name into Recipe.Category for display.</summary>
        private static async Task ApplyFamilyAndCategoryAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Recipe recipe, SilaRecipeWriteDto request, CancellationToken cancellationToken)
        {
            if (request.FamilyId != null)
            {
                bool familyExists = await repository.RecipeFamily
                    .FindByCondition(x => x.Id == request.FamilyId && x.BuyerId == buyerId && x.IsActive)
                    .AnyAsync(cancellationToken);
                if (!familyExists)
                {
                    logger.LogError($"Recipe family not found. FamilyId: {request.FamilyId}, BuyerId: {buyerId}");
                    throw new NotFoundCustomException("Family not found.", "Select an active recipe family of this organization.");
                }
            }

            recipe.FamilyId = request.FamilyId;
            if (request.CategoryId == null)
            {
                recipe.CategoryId = null;
                recipe.Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim();
                return;
            }

            string? categoryName = await repository.RecipeCategory
                .FindByCondition(x => x.Id == request.CategoryId && x.BuyerId == buyerId && x.IsActive)
                .Select(x => x.Name)
                .FirstOrDefaultAsync(cancellationToken);
            if (categoryName == null)
            {
                logger.LogError($"Recipe category not found. CategoryId: {request.CategoryId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Category not found.", "Select an active recipe category of this organization.");
            }

            recipe.CategoryId = request.CategoryId;
            recipe.Category = categoryName;
        }

        /// <summary>Retires (IsActive = false) the ingredient and price rows of one version before it is rewritten.</summary>
        private static async Task RetireVersionRowsAsync(IRepositoryWrapper repository, Guid recipeId, int version, CancellationToken cancellationToken)
        {
            List<RecipeIngredient> oldIngredients = await repository.RecipeIngredient
                .FindByCondition(x => x.RecipeId == recipeId && x.Version == version && x.IsActive)
                .ToListAsync(cancellationToken);
            foreach (RecipeIngredient old in oldIngredients)
            {
                old.IsActive = false;
            }

            repository.RecipeIngredient.UpdateRange(oldIngredients);

            List<RecipeOutletPrice> oldPrices = await repository.RecipeOutletPrice
                .FindByCondition(x => x.RecipeId == recipeId && x.Version == version && x.IsActive)
                .ToListAsync(cancellationToken);
            foreach (RecipeOutletPrice old in oldPrices)
            {
                old.IsActive = false;
            }

            repository.RecipeOutletPrice.UpdateRange(oldPrices);
        }
    }
}

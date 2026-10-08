using System.Text.RegularExpressions;
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
    /// The two recipe masters, families and categories (same shape: Code unique per buyer, Name, Description), read and
    /// written through one set of rules. Kind is "families" or "categories" as in the route.
    /// </summary>
    public static class SilaRecipeMasterRules
    {
        public const string KIND_FAMILIES = "families";
        public const string KIND_CATEGORIES = "categories";

        /// <summary>The columns of the family / category workbook.</summary>
        public static readonly string[] Columns = { "Code", "Name", "Description" };

        private const int CODE_LENGTH = 50;
        private const int NAME_LENGTH = 200;
        private const int DESCRIPTION_LENGTH = 1000;
        private static readonly Regex CodePattern = new Regex(@"^[A-Za-z0-9][A-Za-z0-9_./-]*$", RegexOptions.Compiled);

        /// <summary>The normalised kind; anything else is a 400.</summary>
        public static string ParseKind(ILoggerManager logger, string? kind)
        {
            string value = (kind ?? string.Empty).Trim().ToLowerInvariant();
            if (value != KIND_FAMILIES && value != KIND_CATEGORIES)
            {
                logger.LogError($"Recipe master kind is invalid. Kind: {kind}");
                throw new BadRequestCustomException("Master data type is invalid.", "Use families or categories.");
            }

            return value;
        }

        public static string Label(string kind)
        {
            return kind == KIND_FAMILIES ? "family" : "category";
        }

        /// <summary>The trimmed, upper-cased code and the trimmed texts.</summary>
        public static SilaRecipeMasterWriteDto Normalize(SilaRecipeMasterWriteDto? input)
        {
            return new SilaRecipeMasterWriteDto
            {
                Code = (input?.Code ?? string.Empty).Trim().ToUpperInvariant(),
                Name = (input?.Name ?? string.Empty).Trim(),
                Description = string.IsNullOrWhiteSpace(input?.Description) ? null : input.Description.Trim()
            };
        }

        /// <summary>What is wrong with a normalised record; empty when it can be saved.</summary>
        public static List<string> Errors(SilaRecipeMasterWriteDto record)
        {
            List<string> errors = new List<string>();
            if (record.Code.Length == 0)
            {
                errors.Add("Code is required.");
            }
            else if (record.Code.Length > CODE_LENGTH || !CodePattern.IsMatch(record.Code))
            {
                errors.Add($"Code must be up to {CODE_LENGTH} letters, digits or _ . / - characters.");
            }

            if (record.Name.Length == 0)
            {
                errors.Add("Name is required.");
            }
            else if (record.Name.Length > NAME_LENGTH)
            {
                errors.Add($"Name must be at most {NAME_LENGTH} characters.");
            }

            if ((record.Description?.Length ?? 0) > DESCRIPTION_LENGTH)
            {
                errors.Add($"Description must be at most {DESCRIPTION_LENGTH} characters.");
            }

            return errors;
        }

        /// <summary>Every record of the kind of the buyer (active and inactive), with its active flag.</summary>
        public static async Task<List<(SilaRecipeMasterDto Record, bool IsActive)>> LoadAllAsync(
            IRepositoryWrapper repository, Guid buyerId, string kind, CancellationToken cancellationToken)
        {
            if (kind == KIND_FAMILIES)
            {
                List<RecipeFamily> families = await repository.RecipeFamily.FindByCondition(x => x.BuyerId == buyerId).ToListAsync(cancellationToken);
                return families.Select(x => (new SilaRecipeMasterDto { Id = x.Id, Code = x.Code, Name = x.Name, Description = x.Description }, x.IsActive)).ToList();
            }

            List<RecipeCategory> categories = await repository.RecipeCategory.FindByCondition(x => x.BuyerId == buyerId).ToListAsync(cancellationToken);
            return categories.Select(x => (new SilaRecipeMasterDto { Id = x.Id, Code = x.Code, Name = x.Name, Description = x.Description }, x.IsActive)).ToList();
        }

        /// <summary>Active recipes per family or category id.</summary>
        public static async Task<Dictionary<Guid, int>> RecipeCountsAsync(IRepositoryWrapper repository, Guid buyerId, string kind, CancellationToken cancellationToken)
        {
            IQueryable<Recipe> recipes = repository.Recipe.FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status != Common.SILA_RECIPE_INACTIVE);
            if (kind == KIND_FAMILIES)
            {
                return await recipes.Where(x => x.FamilyId != null)
                    .GroupBy(x => x.FamilyId!.Value)
                    .Select(x => new { Id = x.Key, Count = x.Count() })
                    .ToDictionaryAsync(x => x.Id, x => x.Count, cancellationToken);
            }

            return await recipes.Where(x => x.CategoryId != null)
                .GroupBy(x => x.CategoryId!.Value)
                .Select(x => new { Id = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.Id, x => x.Count, cancellationToken);
        }

        /// <summary>
        /// Creates a record, or reactivates the inactive record with the same code (codes are unique per buyer, also for
        /// inactive rows). The caller checks that no active record has the code and saves.
        /// </summary>
        public static async Task<Guid> CreateAsync(IRepositoryWrapper repository, Guid buyerId, string kind, SilaRecipeMasterWriteDto record)
        {
            if (kind == KIND_FAMILIES)
            {
                RecipeFamily? family = await repository.RecipeFamily.FindFirstByConditionAsync(x => x.BuyerId == buyerId && x.Code == record.Code);
                if (family == null)
                {
                    family = new RecipeFamily { Id = Guid.NewGuid(), BuyerId = buyerId, Code = record.Code };
                    repository.RecipeFamily.Create(family);
                }

                family.Name = record.Name;
                family.Description = record.Description;
                family.IsActive = true;
                return family.Id;
            }

            RecipeCategory? category = await repository.RecipeCategory.FindFirstByConditionAsync(x => x.BuyerId == buyerId && x.Code == record.Code);
            if (category == null)
            {
                category = new RecipeCategory { Id = Guid.NewGuid(), BuyerId = buyerId, Code = record.Code };
                repository.RecipeCategory.Create(category);
            }

            category.Name = record.Name;
            category.Description = record.Description;
            category.IsActive = true;
            return category.Id;
        }

        /// <summary>Updates the code, name and description of an active record, or deactivates it. Not found is a 404. The caller saves.</summary>
        public static async Task UpdateAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, string kind, Guid id, SilaRecipeMasterWriteDto? record)
        {
            if (kind == KIND_FAMILIES)
            {
                RecipeFamily? family = await repository.RecipeFamily.FindFirstByConditionAsync(x => x.Id == id && x.BuyerId == buyerId && x.IsActive);
                NotFoundIfNull(logger, family, kind, id);
                Apply(record, value => family!.Code = value, value => family!.Name = value, value => family!.Description = value, () => family!.IsActive = false);
                return;
            }

            RecipeCategory? category = await repository.RecipeCategory.FindFirstByConditionAsync(x => x.Id == id && x.BuyerId == buyerId && x.IsActive);
            NotFoundIfNull(logger, category, kind, id);
            Apply(record, value => category!.Code = value, value => category!.Name = value, value => category!.Description = value, () => category!.IsActive = false);
        }

        private static void Apply(
            SilaRecipeMasterWriteDto? record, Action<string> setCode, Action<string> setName, Action<string?> setDescription, Action deactivate)
        {
            if (record == null)
            {
                deactivate();
                return;
            }

            setCode(record.Code);
            setName(record.Name);
            setDescription(record.Description);
        }

        /// <summary>
        /// Creates or updates many records by code in one read (Excel import): an unknown code is created, a known code
        /// (active or deleted) gets the name and description and is active again. Returns the ids of the updated categories
        /// whose name changed. The caller saves.
        /// </summary>
        public static async Task<List<(Guid Id, string Name)>> UpsertManyAsync(
            IRepositoryWrapper repository, Guid buyerId, string kind, List<SilaRecipeMasterWriteDto> records, CancellationToken cancellationToken)
        {
            List<(Guid Id, string Name)> renamed = new List<(Guid Id, string Name)>();
            if (kind == KIND_FAMILIES)
            {
                Dictionary<string, RecipeFamily> families = (await repository.RecipeFamily.FindByCondition(x => x.BuyerId == buyerId).ToListAsync(cancellationToken))
                    .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);
                foreach (SilaRecipeMasterWriteDto record in records)
                {
                    if (families.TryGetValue(record.Code, out RecipeFamily? family))
                    {
                        family.Name = record.Name;
                        family.Description = record.Description;
                        family.IsActive = true;
                        repository.RecipeFamily.Update(family);
                        continue;
                    }

                    repository.RecipeFamily.Create(new RecipeFamily
                    {
                        Id = Guid.NewGuid(), BuyerId = buyerId, Code = record.Code, Name = record.Name, Description = record.Description, IsActive = true
                    });
                }

                return renamed;
            }

            Dictionary<string, RecipeCategory> categories = (await repository.RecipeCategory.FindByCondition(x => x.BuyerId == buyerId).ToListAsync(cancellationToken))
                .GroupBy(x => x.Code, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);
            foreach (SilaRecipeMasterWriteDto record in records)
            {
                if (categories.TryGetValue(record.Code, out RecipeCategory? category))
                {
                    if (category.Name != record.Name)
                    {
                        renamed.Add((category.Id, record.Name));
                    }

                    category.Name = record.Name;
                    category.Description = record.Description;
                    category.IsActive = true;
                    repository.RecipeCategory.Update(category);
                    continue;
                }

                repository.RecipeCategory.Create(new RecipeCategory
                {
                    Id = Guid.NewGuid(), BuyerId = buyerId, Code = record.Code, Name = record.Name, Description = record.Description, IsActive = true
                });
            }

            return renamed;
        }

        /// <summary>Writes the category name onto the recipes that use the category (Recipe.Category is kept for display). The caller saves.</summary>
        public static async Task RenameCategoryOnRecipesAsync(
            IRepositoryWrapper repository, Guid buyerId, Guid categoryId, string name, CancellationToken cancellationToken)
        {
            List<Recipe> recipes = await repository.Recipe
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.CategoryId == categoryId && x.Category != name)
                .ToListAsync(cancellationToken);
            foreach (Recipe recipe in recipes)
            {
                recipe.Category = name;
            }

            repository.Recipe.UpdateRange(recipes);
        }

        private static void NotFoundIfNull(ILoggerManager logger, object? entity, string kind, Guid id)
        {
            if (entity == null)
            {
                logger.LogError($"Recipe master not found. Kind: {kind}, Id: {id}");
                throw new NotFoundCustomException($"Recipe {Label(kind)} not found.", $"Select an active recipe {Label(kind)} of this organization.");
            }
        }
    }
}

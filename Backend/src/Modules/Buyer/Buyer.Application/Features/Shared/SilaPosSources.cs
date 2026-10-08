using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>POS source lookups and the validation shared by the source, mapping and import use cases.</summary>
    public static class SilaPosSources
    {
        public const string KIND_FILE = "FILE";
        public const string KIND_API = "API";

        public static readonly string[] POS_SYSTEMS = { "OPERA", "MICROS", "SIMPHONY", "INFOR", "OTHER" };

        public static readonly string[] KINDS = { KIND_FILE, KIND_API };

        public const int MAX_CODE_LENGTH = 100;

        public const int MAX_NAME_LENGTH = 200;

        public static int Limit(int limit)
        {
            return limit <= 0 ? 50 : Math.Min(limit, 200);
        }

        /// <summary>An active POS source of the buyer, tracked. Not found (or another buyer's) is a 404.</summary>
        public static async Task<PosSource> GetSourceAsync(IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid sourceId)
        {
            PosSource? source = await repository.PosSource.FindFirstByConditionAsync(x => x.Id == sourceId && x.BuyerId == buyerId && x.IsActive);
            if (source == null)
            {
                logger.LogError($"POS source not found. PosSourceId: {sourceId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("POS source not found.", "Select an active POS source of this organization.");
            }

            return source;
        }

        /// <summary>
        /// The source of an upload or pull: the requested one (validated), else the default source, else for an API pull the
        /// first API source; null when the buyer has no source (the round-1 code rules still match).
        /// </summary>
        public static async Task<PosSource?> ResolveAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid? requestedId, string kind, CancellationToken cancellationToken)
        {
            if (requestedId != null && requestedId != Guid.Empty)
            {
                return await GetSourceAsync(repository, logger, buyerId, requestedId.Value);
            }

            List<PosSource> sources = await repository.PosSource
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                .ToListAsync(cancellationToken);
            if (kind == KIND_API)
            {
                return sources.FirstOrDefault(x => x.IsDefault && x.IntegrationKind == KIND_API)
                    ?? sources.Where(x => x.IntegrationKind == KIND_API).OrderBy(x => x.Name).FirstOrDefault()
                    ?? sources.FirstOrDefault(x => x.IsDefault);
            }

            return sources.FirstOrDefault(x => x.IsDefault);
        }

        /// <summary>Validates and normalises a source; the messages say what to correct.</summary>
        public static void Validate(ILoggerManager logger, SilaPosSourceWriteDto? request)
        {
            List<string> problems = new List<string>();
            if (request == null)
            {
                logger.LogError("POS source request is empty.");
                throw new BadRequestCustomException("The POS source is missing.", "Send the name, POS system and integration kind.");
            }

            request.Name = (request.Name ?? string.Empty).Trim();
            request.PosSystem = (request.PosSystem ?? string.Empty).Trim().ToUpperInvariant();
            request.IntegrationKind = (request.IntegrationKind ?? string.Empty).Trim().ToUpperInvariant();
            if (request.Name.Length == 0 || request.Name.Length > MAX_NAME_LENGTH)
            {
                problems.Add($"Enter a name of 1 to {MAX_NAME_LENGTH} characters");
            }

            if (!POS_SYSTEMS.Contains(request.PosSystem))
            {
                problems.Add($"POS system must be one of {string.Join(", ", POS_SYSTEMS)}");
            }

            if (!KINDS.Contains(request.IntegrationKind))
            {
                problems.Add("Integration kind must be FILE or API");
            }

            if (problems.Count > 0)
            {
                logger.LogError($"POS source invalid. Problems: {string.Join("; ", problems)}");
                throw new BadRequestCustomException("The POS source is not valid.", string.Join("; ", problems) + ".");
            }
        }

        /// <summary>Outlet locations of the buyer by id with their property, for mapping lists and validation.</summary>
        public static async Task<Dictionary<Guid, (InventoryLocation Location, BuyerProperty? Property)>> GetOutletLocationsAsync(
            IRepositoryWrapper repository, Guid buyerId, IReadOnlyCollection<Guid>? locationIds, CancellationToken cancellationToken)
        {
            IQueryable<InventoryLocation> query = repository.InventoryLocation.FindByCondition(x => x.BuyerId == buyerId && x.LocationType == Common.SILA_LOCATION_OUTLET);
            if (locationIds != null)
            {
                List<Guid> ids = locationIds.Distinct().ToList();
                query = query.Where(x => ids.Contains(x.Id));
            }

            List<InventoryLocation> locations = await query.ToListAsync(cancellationToken);
            List<Guid> propertyIds = locations.Select(x => x.PropertyId).Distinct().ToList();
            Dictionary<Guid, BuyerProperty> properties = propertyIds.Count == 0
                ? new Dictionary<Guid, BuyerProperty>()
                : await repository.BuyerProperty
                    .FindByCondition(x => propertyIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);
            return locations.ToDictionary(
                x => x.Id,
                x => (x, properties.TryGetValue(x.PropertyId, out BuyerProperty? property) ? property : (BuyerProperty?)null));
        }

        public static SilaPosOutletMappingDto ToDto(PosOutletMapping mapping, Dictionary<Guid, (InventoryLocation Location, BuyerProperty? Property)> locations)
        {
            bool found = locations.TryGetValue(mapping.OutletLocationId, out (InventoryLocation Location, BuyerProperty? Property) entry);
            return new SilaPosOutletMappingDto
            {
                Id = mapping.Id,
                PosSourceId = mapping.PosSourceId,
                PosOutletCode = mapping.PosOutletCode,
                PosOutletName = mapping.PosOutletName,
                OutletLocationId = mapping.OutletLocationId,
                LocationCode = found ? entry.Location.LocationCode : null,
                LocationName = found ? entry.Location.LocationName : null,
                PropertyName = found ? entry.Property?.PropertyName : null,
                PlantCode = found ? entry.Property?.PlantCode : null,
                StorageLocationCode = found ? entry.Location.StorageLocationCode : null,
                LocationActive = found && entry.Location.IsActive
            };
        }

        public static SilaPosItemMappingDto ToDto(PosItemMapping mapping, Dictionary<Guid, Recipe> recipes)
        {
            Recipe? recipe = recipes.TryGetValue(mapping.RecipeId, out Recipe? found) ? found : null;
            return new SilaPosItemMappingDto
            {
                Id = mapping.Id,
                PosSourceId = mapping.PosSourceId,
                PosItemCode = mapping.PosItemCode,
                PosItemDescription = mapping.PosItemDescription,
                RecipeId = mapping.RecipeId,
                RecipeCode = recipe?.RecipeCode,
                RecipeName = recipe?.Name,
                RecipeStatus = recipe == null || !recipe.IsActive ? Common.SILA_RECIPE_INACTIVE : recipe.Status,
                RecipeActiveVersion = recipe?.ActiveVersion ?? 0
            };
        }

        public static SilaPosBatchDto ToBatchDto(PosSalesBatch batch, int failed, string? sourceName, string? uploadedByName)
        {
            return new SilaPosBatchDto
            {
                Id = batch.Id,
                BatchNumber = batch.BatchNumber,
                Source = batch.Source,
                FileName = batch.FileName,
                Rows = batch.Rows,
                Accepted = batch.Accepted,
                Duplicates = batch.Duplicates,
                Invalid = batch.Invalid,
                Failed = failed,
                UploadedBy = batch.UploadedBy,
                UploadedByName = uploadedByName,
                DateCreated = batch.DateCreated,
                // Batches of round 1 have no status: they were processed at once.
                Status = string.IsNullOrWhiteSpace(batch.Status) ? Common.SILA_POS_BATCH_PROCESSED : batch.Status,
                PosSourceId = batch.PosSourceId,
                PosSourceName = sourceName,
                BusinessDateFrom = batch.BusinessDateFrom,
                BusinessDateTo = batch.BusinessDateTo
            };
        }

        /// <summary>Trims a code and checks its length; returns the problem or null.</summary>
        public static string? CheckCode(string? value, string label, out string code)
        {
            code = (value ?? string.Empty).Trim();
            if (code.Length == 0)
            {
                return $"{label} is required";
            }

            return code.Length > MAX_CODE_LENGTH ? $"{label} is longer than {MAX_CODE_LENGTH} characters" : null;
        }

        /// <summary>Trims an optional name; returns the problem or null.</summary>
        public static string? CheckName(string? value, string label, out string? name)
        {
            name = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
            return name != null && name.Length > MAX_NAME_LENGTH ? $"{label} is longer than {MAX_NAME_LENGTH} characters" : null;
        }
    }
}

using MediatR;
using Supplier.Domain.Dto;
using Supplier.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;
using SharedKernel.Dto;

namespace Supplier.Application.Features.Queries.BuyerCatalog
{
    public class GetBuyerCatalogQueryHandler
        : IRequestHandler<GetBuyerCatalogQuery, List<BuyerCatalogDto>>
    {
        private const int DefaultLimit = 20;
        private const int MaxLimit = 200;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetBuyerCatalogQueryHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        /// <summary>
        /// One page of the catalog. The catalogs that match the filters come first; when a classification filter is
        /// given, they are followed by the unclassified catalogs of suppliers registered in that classification.
        /// Both parts are paged as one list (offset Index, Limit rows), so large catalogs page without repeats.
        /// </summary>
        public async Task<List<BuyerCatalogDto>> Handle(
            GetBuyerCatalogQuery request,
            CancellationToken cancellationToken)
        {
            int index = Math.Max(0, request.Index);
            int limit = request.Limit <= 0 ? DefaultLimit : Math.Min(request.Limit, MaxLimit);
            string sort = (request.Sort ?? string.Empty).Trim().ToLowerInvariant();
            bool hasClassificationFilter = request.Segment.HasValue || request.Family.HasValue
                || request.Class.HasValue || request.Commodity.HasValue;
            _logger.LogInfo($"Fetching Buyer Catalog. Index: {index}, Limit: {limit}, Sort: {sort}");

            var catalogQuery =
                from catalog in _repository.SupplierCatalog.FindByCondition(x => x.IsActive)
                join supplier in _repository.SupplierBusinessProfile.FindByCondition(x => x.IsActive)
                    on catalog.SupplierId equals supplier.Id
                select new BuyerCatalogDto
                {
                    SupplierId = supplier.Id,
                    CatalogId = catalog.Id,
                    CatalogName = catalog.CatalogName,
                    SupplierName = supplier.OrganizationName,
                    Description = catalog.Description,
                    Price = catalog.Price,
                    Currency = catalog.Currency,
                    UnitOfMeasure = catalog.UnitOfMeasure,
                    Sku = catalog.Sku,
                    AvailableStock = catalog.AvailableStock,
                    DiscountPercent = catalog.DiscountPercent,
                    Segment = catalog.Segment,
                    Family = catalog.Family,
                    Class = catalog.Class,
                    Commodity = catalog.Commodity,
                };

            string? search = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim();
            if (search != null)
            {
                _logger.LogInfo($"Applying search filter: {search}");
                catalogQuery = catalogQuery.Where(x =>
                    x.SupplierName.Contains(search) ||
                    x.CatalogName.Contains(search) ||
                    x.Description.Contains(search));
            }

            // Supplier filter: the suppliers whose name or SNID contains the text.
            List<Guid>? filteredSupplierIds = null;
            if (!string.IsNullOrWhiteSpace(request.Supplier))
            {
                string supplierText = request.Supplier.Trim();
                _logger.LogInfo($"Applying supplier filter: {supplierText}");
                filteredSupplierIds = _repository.SupplierBusinessProfile
                    .FindByCondition(x => x.IsActive &&
                        (x.OrganizationName.Contains(supplierText) || x.SNID.Contains(supplierText)))
                    .Select(x => x.Id)
                    .ToList();
                catalogQuery = catalogQuery.Where(x => filteredSupplierIds.Contains(x.SupplierId));
            }

            if (request.Segment.HasValue) catalogQuery = catalogQuery.Where(x => x.Segment == request.Segment);
            if (request.Family.HasValue) catalogQuery = catalogQuery.Where(x => x.Family == request.Family);
            if (request.Class.HasValue) catalogQuery = catalogQuery.Where(x => x.Class == request.Class);
            if (request.Commodity.HasValue) catalogQuery = catalogQuery.Where(x => x.Commodity == request.Commodity);

            int catalogCount = catalogQuery.Count();
            List<BuyerCatalogDto> result = ApplySort(catalogQuery, sort)
                .Skip(index)
                .Take(limit)
                .ToList();
            _logger.LogInfo($"Fetched {result.Count} records out of {catalogCount} matching catalogs.");

            int remaining = limit - result.Count;
            if (remaining > 0 && hasClassificationFilter)
            {
                // The unclassified catalogs continue the list after the classified ones: skip what earlier pages showed.
                int additionalSkip = Math.Max(0, index - catalogCount);
                result.AddRange(FetchUnclassifiedCatalogs(request, search, filteredSupplierIds, sort, additionalSkip, remaining));
            }

            if (!result.Any())
            {
                _logger.LogError("No suppliers found for the given filters.");
                throw new NotFoundCustomException(
                    "No suppliers found.",
                    "No catalog or supplier category found.");
            }

            AttachAssets(result);
            _logger.LogInfo($"Returned {result.Count} records.");
            return await Task.FromResult(result);
        }

        /// <summary>
        /// Catalogs without the filtered classification, of the suppliers registered in that classification.
        /// </summary>
        private List<BuyerCatalogDto> FetchUnclassifiedCatalogs(
            GetBuyerCatalogQuery request,
            string? search,
            List<Guid>? filteredSupplierIds,
            string sort,
            int skip,
            int take)
        {
            var supplierCategoryQuery = _repository.SupplierCategory.FindByCondition(x => x.IsActive);
            if (request.Segment.HasValue) supplierCategoryQuery = supplierCategoryQuery.Where(x => x.Segment == request.Segment);
            if (request.Family.HasValue) supplierCategoryQuery = supplierCategoryQuery.Where(x => x.Family == request.Family);
            if (request.Class.HasValue) supplierCategoryQuery = supplierCategoryQuery.Where(x => x.Class == request.Class);
            if (request.Commodity.HasValue) supplierCategoryQuery = supplierCategoryQuery.Where(x => x.Commodity == request.Commodity);
            List<Guid> supplierIds = supplierCategoryQuery.Select(x => x.SupplierId).Distinct().ToList();
            _logger.LogInfo($"Fetching unclassified catalogs of {supplierIds.Count} suppliers in the classification.");

            var additionalQuery =
                from catalog in _repository.SupplierCatalog.FindByCondition(x => x.IsActive)
                join supplier in _repository.SupplierBusinessProfile.FindByCondition(x => x.IsActive)
                    on catalog.SupplierId equals supplier.Id
                where supplierIds.Contains(catalog.SupplierId)
                select new BuyerCatalogDto
                {
                    SupplierId = supplier.Id,
                    CatalogId = catalog.Id,
                    SupplierName = supplier.OrganizationName,
                    CatalogName = catalog.CatalogName,
                    Description = catalog.Description,
                    Price = catalog.Price,
                    Currency = catalog.Currency,
                    UnitOfMeasure = catalog.UnitOfMeasure,
                    Sku = catalog.Sku,
                    AvailableStock = catalog.AvailableStock,
                    DiscountPercent = catalog.DiscountPercent,
                    Segment = catalog.Segment,
                    Family = catalog.Family,
                    Class = catalog.Class,
                    Commodity = catalog.Commodity,
                };

            if (search != null)
            {
                additionalQuery = additionalQuery.Where(x =>
                    x.SupplierName.Contains(search) ||
                    x.CatalogName.Contains(search) ||
                    x.Description.Contains(search));
            }
            if (filteredSupplierIds != null) additionalQuery = additionalQuery.Where(x => filteredSupplierIds.Contains(x.SupplierId));
            if (request.Segment.HasValue) additionalQuery = additionalQuery.Where(x => x.Segment == null);
            if (request.Family.HasValue) additionalQuery = additionalQuery.Where(x => x.Family == null);
            if (request.Class.HasValue) additionalQuery = additionalQuery.Where(x => x.Class == null);
            if (request.Commodity.HasValue) additionalQuery = additionalQuery.Where(x => x.Commodity == null);

            return ApplySort(additionalQuery, sort).Skip(skip).Take(take).ToList();
        }

        /// <summary>
        /// Order by name or price; the catalog id keeps the order stable between pages.
        /// </summary>
        private static IQueryable<BuyerCatalogDto> ApplySort(IQueryable<BuyerCatalogDto> query, string sort) =>
            sort switch
            {
                "name_desc" => query.OrderByDescending(x => x.CatalogName).ThenBy(x => x.CatalogId),
                "price" => query.OrderBy(x => x.Price).ThenBy(x => x.CatalogName).ThenBy(x => x.CatalogId),
                "price_desc" => query.OrderByDescending(x => x.Price).ThenBy(x => x.CatalogName).ThenBy(x => x.CatalogId),
                _ => query.OrderBy(x => x.CatalogName).ThenBy(x => x.CatalogId),
            };

        /// <summary>
        /// The active assets (images, files) of every catalog on the page, read with two queries for the whole page.
        /// </summary>
        private void AttachAssets(List<BuyerCatalogDto> catalogs)
        {
            foreach (var catalog in catalogs.Where(x => !x.CatalogId.HasValue))
            {
                _logger.LogInfo($"Catalog ID is null for supplier ID: {catalog.SupplierId}");
                throw new NotFoundCustomException(
                    "Catalog ID is null.",
                    $"Catalog ID is null for supplier ID: {catalog.SupplierId}");
            }

            List<Guid> catalogIds = catalogs.Select(x => x.CatalogId!.Value).Distinct().ToList();
            var mappings = _repository.CatalogAssetMapping
                .FindByCondition(x => catalogIds.Contains(x.CatalogId) && x.IsActive)
                .Select(x => new { x.CatalogId, x.AssetId })
                .ToList();
            List<Guid> assetIds = mappings.Select(x => x.AssetId).Distinct().ToList();
            var assetsById = assetIds.Count == 0
                ? new Dictionary<Guid, AssetDto>()
                : _repository.Asset
                    .FindByCondition(x => assetIds.Contains(x.Id) && x.IsActive)
                    .ToList()
                    .ToDictionary(asset => asset.Id, asset => new AssetDto
                    {
                        Id = asset.Id,
                        AssetType = asset.AssetType?.ToString(),
                        AssetName = asset.AssetName,
                        FileType = asset.FileType.ToString(),
                        FileName = asset.FileName
                    });

            foreach (var catalog in catalogs)
            {
                catalog.Asset = mappings
                    .Where(x => x.CatalogId == catalog.CatalogId!.Value)
                    .Select(x => x.AssetId)
                    .Distinct()
                    .Where(assetsById.ContainsKey)
                    .Select(assetId => assetsById[assetId])
                    .ToList();
            }
        }
    }
}

using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;

namespace Buyer.Application.Features.Queries.SearchSilaRecipeIngredients
{
    /// <summary>
    /// One page of active Item Master materials for the recipe editor, by code or description, material group, category
    /// (product type) and supplier (materials on purchase orders of that supplier; a SILA supplier also matches by alias),
    /// with the price status, the unit conversions and the suppliers of each material.
    /// </summary>
    public class SearchSilaRecipeIngredientsQueryHandler : IRequestHandler<SearchSilaRecipeIngredientsQuery, SilaRecipeIngredientPageDto>
    {
        private const int MAX_LIMIT = 200;
        private const int MAX_TEXT = 100;
        private const int MAX_SUPPLIER_CODES = 2000;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SearchSilaRecipeIngredientsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaRecipeIngredientPageDto> Handle(SearchSilaRecipeIngredientsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Searching recipe ingredients. OrganizationId: {request.OrganizationId}, Search: {request.Search}, Group: {request.MaterialGroup}, Category: {request.Category}, Supplier: {request.Supplier}");

            if (request.Index < 0 || request.Limit < 1 || request.Limit > MAX_LIMIT)
            {
                _logger.LogError($"Ingredient search paging is invalid. Index: {request.Index}, Limit: {request.Limit}");
                throw new BadRequestCustomException("Paging is invalid.", $"Use an index of 0 or more and a limit between 1 and {MAX_LIMIT}.");
            }

            if ((request.Search?.Length ?? 0) > MAX_TEXT || (request.Supplier?.Length ?? 0) > MAX_TEXT * 2)
            {
                _logger.LogError("Ingredient search text too long.");
                throw new BadRequestCustomException("Search text is too long.", $"Use at most {MAX_TEXT} characters.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            IQueryable<MaterialEntity> query = _repository.ItemBuyerMaster.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                // Code, description, material group, or a supplier (by name) that delivered the material on a purchase order.
                string search = request.Search.Trim();
                List<string> supplierCodes = await _repository.PurchaseOrderItem
                    .FindByCondition(x => x.IsActive && x.MaterialCode != null
                        && x.PurchaseOrder.BuyerId == buyer.Id && x.PurchaseOrder.SupplierName != null && x.PurchaseOrder.SupplierName.Contains(search))
                    .Select(x => x.MaterialCode!)
                    .Distinct()
                    .Take(MAX_SUPPLIER_CODES)
                    .ToListAsync(cancellationToken);
                query = query.Where(x => x.MaterialCode.Contains(search) || x.Description.Contains(search)
                    || (x.MaterialGroup != null && x.MaterialGroup.Contains(search)) || supplierCodes.Contains(x.MaterialCode));
            }

            if (!string.IsNullOrWhiteSpace(request.MaterialType))
            {
                string type = request.MaterialType.Trim();
                query = query.Where(x => x.InventoryType == type);
            }

            if (request.SupplierId != null)
            {
                string? supplierName = await _repository.SilaSupplier
                    .FindByCondition(x => x.Id == request.SupplierId && x.BuyerId == buyer.Id && x.IsActive)
                    .Select(x => x.Name)
                    .FirstOrDefaultAsync(cancellationToken);
                if (supplierName == null)
                {
                    _logger.LogError($"Ingredient search supplier not found. SupplierId: {request.SupplierId}");
                    throw new NotFoundCustomException("Supplier not found.", "Select an active supplier of this organization.");
                }

                List<string> codes = await MaterialCodesOfSupplierAsync(buyer.Id, supplierName, cancellationToken);
                query = query.Where(x => codes.Contains(x.MaterialCode));
            }

            if (!string.IsNullOrWhiteSpace(request.MaterialGroup))
            {
                string group = request.MaterialGroup.Trim();
                query = query.Where(x => x.MaterialGroup == group);
            }

            if (!string.IsNullOrWhiteSpace(request.Category))
            {
                string category = request.Category.Trim();
                query = query.Where(x => x.ProductType == category);
            }

            if (!string.IsNullOrWhiteSpace(request.Supplier))
            {
                List<string> codes = await MaterialCodesOfSupplierAsync(buyer.Id, request.Supplier.Trim(), cancellationToken);
                query = query.Where(x => codes.Contains(x.MaterialCode));
            }

            int total = await query.CountAsync(cancellationToken);
            List<MaterialEntity> materials = await query
                .OrderBy(x => x.MaterialCode)
                .Skip(request.Index * request.Limit)
                .Take(request.Limit)
                .ToListAsync(cancellationToken);

            List<Guid> ids = materials.Select(x => x.Id).ToList();
            List<string> pageCodes = materials.Select(x => x.MaterialCode).ToList();
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(_repository, ids, cancellationToken);
            HashSet<Guid> pending = (await _repository.MaterialPriceChange
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Status == Common.SILA_PRICE_PENDING_APPROVAL && ids.Contains(x.MaterialId))
                .Select(x => x.MaterialId)
                .ToListAsync(cancellationToken)).ToHashSet();
            Dictionary<string, List<string>> suppliers = (await _repository.PurchaseOrderItem
                .FindByCondition(x => x.IsActive && x.MaterialCode != null && pageCodes.Contains(x.MaterialCode)
                    && x.PurchaseOrder.BuyerId == buyer.Id && x.PurchaseOrder.SupplierName != null)
                .Select(x => new { x.MaterialCode, x.PurchaseOrder.SupplierName })
                .Distinct()
                .ToListAsync(cancellationToken))
                .GroupBy(x => x.MaterialCode!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(x => x.Key, x => x.Select(y => y.SupplierName!).OrderBy(y => y).ToList(), StringComparer.OrdinalIgnoreCase);

            List<SilaRecipeIngredientOptionDto> items = materials.Select(x => new SilaRecipeIngredientOptionDto
            {
                Id = x.Id,
                MaterialCode = x.MaterialCode,
                Description = x.Description,
                MaterialGroup = x.MaterialGroup,
                Category = x.ProductType,
                BaseUom = UomConverter.BaseUomOf(x),
                UnitCost = x.UnitCost,
                Currency = x.Currency,
                PriceStatus = SilaRecipeReadiness.PriceStatus(x, pending.Contains(x.Id)),
                Conversions = (conversions.TryGetValue(x.Id, out List<MaterialUomConversion>? list) ? list : new List<MaterialUomConversion>())
                    .Select(c => new SilaUomConversionDto { Id = c.Id, FromUom = c.FromUom, ToUom = c.ToUom, Factor = c.Factor })
                    .ToList(),
                Suppliers = suppliers.TryGetValue(x.MaterialCode, out List<string>? names) ? names : new List<string>()
            }).ToList();

            _logger.LogInfo($"Recipe ingredients found. Count: {items.Count}, Total: {total}");
            return new SilaRecipeIngredientPageDto { Items = items, Total = total, Index = request.Index, Limit = request.Limit };
        }

        /// <summary>Codes of the materials on purchase orders of the supplier, by its name or (SILA supplier) one of its aliases.</summary>
        private async Task<List<string>> MaterialCodesOfSupplierAsync(Guid buyerId, string supplier, CancellationToken cancellationToken)
        {
            List<string> names = new List<string> { supplier };
            string? aliases = await _repository.SilaSupplier
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Name == supplier)
                .Select(x => x.Aliases)
                .FirstOrDefaultAsync(cancellationToken);
            if (!string.IsNullOrWhiteSpace(aliases))
            {
                names.AddRange(aliases.Split(',', ';').Select(x => x.Trim()).Where(x => x.Length > 0));
            }

            return await _repository.PurchaseOrderItem
                .FindByCondition(x => x.IsActive && x.MaterialCode != null
                    && x.PurchaseOrder.BuyerId == buyerId && x.PurchaseOrder.SupplierName != null && names.Contains(x.PurchaseOrder.SupplierName))
                .Select(x => x.MaterialCode!)
                .Distinct()
                .ToListAsync(cancellationToken);
        }
    }
}

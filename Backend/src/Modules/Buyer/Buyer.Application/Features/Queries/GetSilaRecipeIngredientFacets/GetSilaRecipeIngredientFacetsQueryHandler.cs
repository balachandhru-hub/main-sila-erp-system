using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaRecipeIngredientFacets
{
    /// <summary>
    /// Distinct material groups and product types of the active Item Master, and the supplier names: suppliers on the
    /// buyer's purchase orders plus the active SILA suppliers. Each list is sorted and capped.
    /// </summary>
    public class GetSilaRecipeIngredientFacetsQueryHandler : IRequestHandler<GetSilaRecipeIngredientFacetsQuery, SilaRecipeIngredientFacetsDto>
    {
        private const int MAX_VALUES = 500;
        private const string SUPPLIER_ACTIVE = "ACTIVE";

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaRecipeIngredientFacetsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaRecipeIngredientFacetsDto> Handle(GetSilaRecipeIngredientFacetsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching recipe ingredient facets. OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<string> groups = await _repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.MaterialGroup != null && x.MaterialGroup != "")
                .Select(x => x.MaterialGroup)
                .Distinct()
                .OrderBy(x => x)
                .Take(MAX_VALUES)
                .ToListAsync(cancellationToken);
            List<string> categories = await _repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.ProductType != null && x.ProductType != "")
                .Select(x => x.ProductType)
                .Distinct()
                .OrderBy(x => x)
                .Take(MAX_VALUES)
                .ToListAsync(cancellationToken);
            List<string> poSuppliers = await _repository.PurchaseOrder
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.SupplierName != null && x.SupplierName != "")
                .Select(x => x.SupplierName!)
                .Distinct()
                .Take(MAX_VALUES)
                .ToListAsync(cancellationToken);
            var silaSupplierRows = await _repository.SilaSupplier
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Status == SUPPLIER_ACTIVE)
                .OrderBy(x => x.Name)
                .Select(x => new { x.Id, x.SupplierCode, x.Name })
                .Take(MAX_VALUES)
                .ToListAsync(cancellationToken);
            List<string> silaSuppliers = silaSupplierRows.Select(x => x.Name).ToList();
            List<string> materialTypes = await _repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.InventoryType != null && x.InventoryType != "")
                .Select(x => x.InventoryType!)
                .Distinct()
                .OrderBy(x => x)
                .Take(MAX_VALUES)
                .ToListAsync(cancellationToken);

            SilaRecipeIngredientFacetsDto result = new SilaRecipeIngredientFacetsDto
            {
                MaterialGroups = groups,
                Categories = categories,
                Suppliers = poSuppliers
                    .Concat(silaSuppliers)
                    .Select(x => x.Trim())
                    .Where(x => x.Length > 0)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(x => x)
                    .Take(MAX_VALUES)
                    .ToList(),
                MaterialTypes = materialTypes
            };
            HashSet<string> named = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var supplier in silaSupplierRows.Where(x => named.Add(x.Name.Trim())))
            {
                result.SupplierOptions.Add(new SilaRecipeSupplierOptionDto { Id = supplier.Id, Code = supplier.SupplierCode, Name = supplier.Name.Trim() });
            }

            foreach (string name in result.Suppliers.Where(x => named.Add(x)))
            {
                result.SupplierOptions.Add(new SilaRecipeSupplierOptionDto { Name = name });
            }

            result.SupplierOptions = result.SupplierOptions.OrderBy(x => x.Name).Take(MAX_VALUES).ToList();

            _logger.LogInfo($"Recipe ingredient facets fetched. Groups: {groups.Count}, Categories: {categories.Count}, Suppliers: {result.Suppliers.Count}");
            return result;
        }
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Enums;
using Supplier.Application.Features.Commands.RunOrganizationIntegrations;
using Supplier.Domain.Dto;
using Supplier.Infrastructure.Contracts.IRepository;
using SharedKernel.LoggerServices;

namespace Supplier.Application.Features.Queries.BuyerCatalog
{
    public class GetBuyerCatalogStockQueryHandler
        : IRequestHandler<GetBuyerCatalogStockQuery, List<BuyerCatalogStockDto>>
    {
        // A buyer waiting on a refresh is not held up by a slow supplier API for long.
        private static readonly TimeSpan RefreshTimeout = TimeSpan.FromSeconds(20);

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IMediator _mediator;

        public GetBuyerCatalogStockQueryHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IMediator mediator)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
        }

        public async Task<List<BuyerCatalogStockDto>> Handle(
            GetBuyerCatalogStockQuery request,
            CancellationToken cancellationToken)
        {
            List<Guid> catalogIds = (request.CatalogIds ?? new List<Guid>())
                .Distinct()
                .ToList();

            _logger.LogInfo(
                $"Fetching Buyer Catalog stock. CatalogIds: {catalogIds.Count}");

            if (catalogIds.Count == 0)
            {
                _logger.LogInfo("No catalog ids were sent. Returning an empty list.");
                return new List<BuyerCatalogStockDto>();
            }

            // A supplier that publishes its stock through its own API is asked for it now, so the
            // figures below are current. Suppliers without a stock API keep the stock they typed in.
            List<Guid> supplierOrganizationIds = await (
                from catalog in _repository.SupplierCatalog.FindByCondition(
                    x => x.IsActive && catalogIds.Contains(x.Id))
                join supplier in _repository.SupplierBusinessProfile.FindByCondition(
                    x => x.IsActive)
                    on catalog.SupplierId equals supplier.Id
                select supplier.OrganizationId
            ).Distinct().ToListAsync(cancellationToken);
            await RefreshProductStockAsync(supplierOrganizationIds, cancellationToken);

            IQueryable<BuyerCatalogStockDto> catalogQuery =
                from catalog in _repository.SupplierCatalog.FindByCondition(
                    x => x.IsActive && catalogIds.Contains(x.Id))

                join supplier in _repository.SupplierBusinessProfile.FindByCondition(
                    x => x.IsActive)
                    on catalog.SupplierId equals supplier.Id

                select new BuyerCatalogStockDto
                {
                    CatalogId = catalog.Id,
                    SupplierId = supplier.Id,
                    SupplierName = supplier.OrganizationName,
                    Sku = catalog.Sku,
                    CatalogName = catalog.CatalogName,
                    Description = catalog.Description,
                    Price = catalog.Price,
                    Currency = catalog.Currency,
                    UnitOfMeasure = catalog.UnitOfMeasure,
                    DiscountPercent = catalog.DiscountPercent,
                    AvailableStock = catalog.AvailableStock
                };

            List<BuyerCatalogStockDto> result = await catalogQuery.ToListAsync(cancellationToken);

            _logger.LogInfo(
                $"Returned {result.Count} catalog stock record(s) for {catalogIds.Count} catalog id(s).");

            return result;
        }

        /// <summary>
        /// Runs the active product stock APIs of these suppliers now. A supplier without one is left as
        /// it is. Never throws: when the refresh cannot be done, the stock already stored is what the
        /// buyer sees, and the next refresh tries again.
        /// </summary>
        private async Task RefreshProductStockAsync(List<Guid> supplierOrganizationIds, CancellationToken cancellationToken)
        {
            if (supplierOrganizationIds.Count == 0)
            {
                return;
            }

            using CancellationTokenSource timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(RefreshTimeout);
            try
            {
                RunOrganizationIntegrationsResultDto result = await _mediator.Send(new RunOrganizationIntegrationsCommand
                {
                    OrganizationIds = supplierOrganizationIds,
                    ProcessType = IntegrationProcessType.GET_CATALOG_STOCK
                }, timeout.Token);
                if (result.Failed > 0)
                {
                    _logger.LogError($"Product stock could not be refreshed for every supplier. Failed: {result.Failed}, Suppliers: {supplierOrganizationIds.Count}");
                }
            }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogError($"Product stock could not be refreshed. Suppliers: {supplierOrganizationIds.Count}, Error: {exception.Message}");
            }
        }
    }
}

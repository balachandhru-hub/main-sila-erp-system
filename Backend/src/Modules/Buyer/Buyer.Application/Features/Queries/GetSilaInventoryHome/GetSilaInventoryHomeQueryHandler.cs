using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaInventoryHome
{
    /// <summary>
    /// Counts the work waiting at one of the caller's locations (the requested one, otherwise the first by name):
    /// transfers to approve, transfers to receive, open stock counts, open enquiries, open alerts and low-stock items.
    /// </summary>
    public class GetSilaInventoryHomeQueryHandler : IRequestHandler<GetSilaInventoryHomeQuery, SilaInventoryHomeDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaInventoryHomeQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaInventoryHomeDto> Handle(GetSilaInventoryHomeQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching inventory home. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, LocationId: {request.LocationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLocation? location;
            if (request.LocationId != null && request.LocationId != Guid.Empty)
            {
                location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.LocationId.Value);
                await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, location.Id, cancellationToken);
            }
            else
            {
                List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
                location = await _repository.InventoryLocation
                    .FindByCondition(x => locationIds.Contains(x.Id))
                    .OrderBy(x => x.LocationName)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            if (location == null)
            {
                _logger.LogInfo($"Inventory home fetched without a location. UserId: {request.UserId}");
                return new SilaInventoryHomeDto();
            }

            Guid id = location.Id;
            int pendingApprovals = await _repository.InternalTransferOrder
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.FromLocationId == id && x.Status == Common.SILA_ITO_PENDING_APPROVAL)
                .CountAsync(cancellationToken);
            int inTransit = await _repository.InternalTransferOrder
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.ToLocationId == id && x.Status == Common.SILA_ITO_DISPATCHED)
                .CountAsync(cancellationToken);
            int openCounts = await _repository.StockCount
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.LocationId == id &&
                    (x.Status == Common.SILA_COUNT_IN_PROGRESS || x.Status == Common.SILA_COUNT_SUBMITTED || x.Status == Common.SILA_COUNT_ENQUIRY_PENDING))
                .CountAsync(cancellationToken);
            int openEnquiries = await _repository.StockShortageEnquiry
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.LocationId == id &&
                    (x.Status == Common.SILA_ENQUIRY_SENT || x.Status == Common.SILA_ENQUIRY_RESPONDED))
                .CountAsync(cancellationToken);
            int openAlerts = await _repository.InventoryAlert
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.LocationId == id &&
                    (x.Status == Common.SILA_ALERT_NEW || x.Status == Common.SILA_ALERT_ACKNOWLEDGED))
                .CountAsync(cancellationToken);

            List<InventoryLocationMaterial> levels = await _repository.InventoryLocationMaterial
                .FindByCondition(x => x.LocationId == id && x.IsActive && (x.MinimumStock != null || x.ReorderPoint != null))
                .ToListAsync(cancellationToken);
            List<Guid> levelMaterialIds = levels.Select(x => x.MaterialId).ToList();
            Dictionary<Guid, decimal> onHand = await _repository.InventoryBalance
                .FindByCondition(x => x.LocationId == id && levelMaterialIds.Contains(x.MaterialId))
                .ToDictionaryAsync(x => x.MaterialId, x => x.OnHandQty, cancellationToken);
            int lowStock = levels.Count(x =>
            {
                decimal quantity = onHand.TryGetValue(x.MaterialId, out decimal value) ? value : 0;
                decimal threshold = Math.Max(x.MinimumStock ?? 0, x.ReorderPoint ?? 0);
                return quantity <= threshold;
            });

            string? propertyName = await _repository.BuyerProperty
                .FindByCondition(x => x.Id == location.PropertyId)
                .Select(x => x.PropertyName)
                .FirstOrDefaultAsync(cancellationToken);

            _logger.LogInfo($"Inventory home fetched. LocationId: {id}, Approvals: {pendingApprovals}, InTransit: {inTransit}, LowStock: {lowStock}");
            return new SilaInventoryHomeDto
            {
                LocationId = id,
                LocationCode = location.LocationCode,
                LocationName = location.LocationName,
                LocationType = location.LocationType,
                PropertyName = propertyName,
                PendingTransferApprovals = pendingApprovals,
                InTransitToReceive = inTransit,
                OpenStockCounts = openCounts,
                OpenEnquiries = openEnquiries,
                OpenAlerts = openAlerts,
                LowStockItems = lowStock
            };
        }
    }
}

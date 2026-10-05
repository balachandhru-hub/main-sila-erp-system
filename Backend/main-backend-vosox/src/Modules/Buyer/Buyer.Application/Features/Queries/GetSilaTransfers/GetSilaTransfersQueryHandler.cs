using Microsoft.EntityFrameworkCore;
using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaTransfers
{
    /// <summary>
    /// Transfer list tabs: mine (requested by me), to-approve (waiting for approval or dispatch at a source I can access),
    /// in-transit (dispatched to a destination I can access) and completed (closed transfers of my locations or requests).
    /// </summary>
    public class GetSilaTransfersQueryHandler : IRequestHandler<GetSilaTransfersQuery, List<SilaTransferListItemDto>>
    {
        private const string TAB_MINE = "mine";
        private const string TAB_TO_APPROVE = "to-approve";
        private const string TAB_IN_TRANSIT = "in-transit";
        private const string TAB_COMPLETED = "completed";

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaTransfersQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<List<SilaTransferListItemDto>> Handle(GetSilaTransfersQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching transfers. Tab: {request.Tab}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            string tab = string.IsNullOrWhiteSpace(request.Tab) ? TAB_MINE : request.Tab.Trim().ToLowerInvariant();
            Guid userId = request.UserId;

            IQueryable<InternalTransferOrder> query = _repository.InternalTransferOrder.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            switch (tab)
            {
                case TAB_MINE:
                    query = query.Where(x => x.RequestedBy == userId);
                    break;
                case TAB_TO_APPROVE:
                    query = query.Where(x => (x.Status == Common.SILA_ITO_PENDING_APPROVAL || x.Status == Common.SILA_ITO_APPROVED)
                        && locationIds.Contains(x.FromLocationId));
                    break;
                case TAB_IN_TRANSIT:
                    query = query.Where(x => x.Status == Common.SILA_ITO_DISPATCHED && locationIds.Contains(x.ToLocationId));
                    break;
                case TAB_COMPLETED:
                    query = query.Where(x => (x.Status == Common.SILA_ITO_RECEIVED
                            || x.Status == Common.SILA_ITO_DISCREPANCY
                            || x.Status == Common.SILA_ITO_REJECTED
                            || x.Status == Common.SILA_ITO_CANCELLED)
                        && (x.RequestedBy == userId || locationIds.Contains(x.FromLocationId) || locationIds.Contains(x.ToLocationId)));
                    break;
                default:
                    _logger.LogError($"Unknown transfer tab. Tab: {request.Tab}");
                    throw new BadRequestCustomException("Unknown transfer list.", "Use mine, to-approve, in-transit or completed.");
            }

            query = await ApplyFiltersAsync(query, request, buyer.Id, cancellationToken);
            List<InternalTransferOrder> transfers = await query
                .OrderByDescending(x => x.DateCreated)
                .Skip(SilaInputRules.Index(request.Index))
                .Take(SilaInputRules.Limit(request.Limit))
                .ToListAsync(cancellationToken);
            List<Guid> transferIds = transfers.Select(x => x.Id).ToList();
            List<InternalTransferOrderItem> items = await _repository.InternalTransferOrderItem
                .FindByCondition(x => transferIds.Contains(x.InternalTransferOrderId) && x.IsActive)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, int> lineCounts = items.GroupBy(x => x.InternalTransferOrderId).ToDictionary(x => x.Key, x => x.Count());
            List<Guid> endpointIds = transfers.SelectMany(x => new[] { x.FromLocationId, x.ToLocationId }).Distinct().ToList();
            Dictionary<Guid, string> types = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && endpointIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.LocationType, cancellationToken);
            SilaTransferFigures.CostBook book = await SilaTransferFigures.GetCostBookAsync(
                _repository, buyer.Id, transfers.Select(x => x.FromLocationId), items.Select(x => x.MaterialId), cancellationToken);
            Dictionary<Guid, (decimal? Value, string? Currency)> totals = SilaTransferFigures.Totals(transfers, items, book);
            Dictionary<Guid, string> locations = await SilaMovementLookup.GetLocationNamesAsync(
                _repository, buyer.Id, transfers.SelectMany(x => new[] { x.FromLocationId, x.ToLocationId }), cancellationToken);
            Dictionary<Guid, string> users = await SilaMovementLookup.GetUserNamesAsync(
                _identityApiClient, _logger, transfers.Select(x => x.RequestedBy), cancellationToken);

            List<SilaTransferListItemDto> result = transfers.Select(x => new SilaTransferListItemDto
            {
                Id = x.Id,
                ItoNumber = x.ItoNumber,
                Mode = x.Mode,
                Status = x.Status,
                FromLocationId = x.FromLocationId,
                FromLocationName = locations.GetValueOrDefault(x.FromLocationId),
                ToLocationId = x.ToLocationId,
                ToLocationName = locations.GetValueOrDefault(x.ToLocationId),
                RequestedBy = x.RequestedBy,
                RequestedByName = SilaMovementLookup.NameOf(users, x.RequestedBy),
                RequestedOn = x.DateCreated,
                RequiredBy = x.RequiredBy,
                LineCount = lineCounts.GetValueOrDefault(x.Id),
                FromLocationType = types.GetValueOrDefault(x.FromLocationId),
                ToLocationType = types.GetValueOrDefault(x.ToLocationId),
                TransferRelationship = SilaTransferFigures.Relationship(types.GetValueOrDefault(x.FromLocationId), types.GetValueOrDefault(x.ToLocationId)),
                TotalValue = totals.TryGetValue(x.Id, out (decimal? Value, string? Currency) total) ? total.Value : null,
                Currency = totals.TryGetValue(x.Id, out (decimal? Value, string? Currency) currency) ? currency.Currency : null
            }).ToList();

            _logger.LogInfo($"Transfers fetched. Tab: {tab}, Count: {result.Count}");
            return result;
        }

        /// <summary>Optional list filters: mode, source, destination, property of the source and the request date range.</summary>
        private async Task<IQueryable<InternalTransferOrder>> ApplyFiltersAsync(
            IQueryable<InternalTransferOrder> query, GetSilaTransfersQuery request, Guid buyerId, CancellationToken cancellationToken)
        {
            if (!string.IsNullOrWhiteSpace(request.Mode))
            {
                string mode = SilaInputRules.OneOf(_logger, request.Mode, new[] { Common.SILA_ITO_STANDARD, Common.SILA_ITO_QUICK }, "mode");
                query = query.Where(x => x.Mode == mode);
            }

            if (request.FromLocationId != null)
            {
                Guid fromId = request.FromLocationId.Value;
                query = query.Where(x => x.FromLocationId == fromId);
            }

            if (request.ToLocationId != null)
            {
                Guid toId = request.ToLocationId.Value;
                query = query.Where(x => x.ToLocationId == toId);
            }

            if (request.PropertyId != null)
            {
                Guid propertyId = request.PropertyId.Value;
                List<Guid> propertyLocationIds = await _repository.InventoryLocation
                    .FindByCondition(x => x.BuyerId == buyerId && x.PropertyId == propertyId)
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken);
                query = query.Where(x => propertyLocationIds.Contains(x.FromLocationId));
            }

            if (request.FromDate != null && request.ToDate != null && request.FromDate.Value.Date > request.ToDate.Value.Date)
            {
                _logger.LogError($"Transfer date range is reversed. From: {request.FromDate}, To: {request.ToDate}");
                throw new BadRequestCustomException("The from date is after the to date.", "Pick a from date on or before the to date.");
            }

            if (request.FromDate != null)
            {
                DateTime fromDate = request.FromDate.Value.Date;
                query = query.Where(x => x.DateCreated >= fromDate);
            }

            if (request.ToDate != null)
            {
                DateTime toDate = request.ToDate.Value.Date.AddDays(1);
                query = query.Where(x => x.DateCreated < toDate);
            }

            return query;
        }
    }
}

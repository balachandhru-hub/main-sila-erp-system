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

namespace Buyer.Application.Features.Queries.GetSilaTransfer
{
    /// <summary>One transfer with all its lines, the event timeline and the actions the signed-in user may take.</summary>
    public class GetSilaTransferQueryHandler : IRequestHandler<GetSilaTransferQuery, SilaTransferDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaTransferQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<SilaTransferDetailDto> Handle(GetSilaTransferQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching transfer. TransferId: {request.TransferId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InternalTransferOrder? transfer = await _repository.InternalTransferOrder
                .FindByCondition(x => x.Id == request.TransferId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (transfer == null)
            {
                _logger.LogError($"Transfer not found. TransferId: {request.TransferId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Transfer not found.", "Open a transfer order of this organization.");
            }

            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            if (transfer.RequestedBy != request.UserId
                && !locationIds.Contains(transfer.FromLocationId)
                && !locationIds.Contains(transfer.ToLocationId))
            {
                _logger.LogError($"User has no access to the transfer. TransferId: {transfer.Id}, UserId: {request.UserId}");
                throw new ForBiddenCustomException("No access to this transfer.", "Ask your administrator to assign you to one of its locations.");
            }

            List<InternalTransferOrderItem> items = await SilaTransferRules.GetItemsAsync(_repository, transfer.Id, cancellationToken);
            List<InventoryWorkflowEvent> events = await _repository.InventoryWorkflowEvent
                .FindByCondition(x => x.BuyerId == buyer.Id && x.ReferenceType == Common.SILA_REF_ITO && x.ReferenceId == transfer.Id && x.IsActive)
                .OrderBy(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, string> locations = await SilaMovementLookup.GetLocationNamesAsync(
                _repository, buyer.Id, new[] { transfer.FromLocationId, transfer.ToLocationId }, cancellationToken);
            Dictionary<Guid, string> types = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && (x.Id == transfer.FromLocationId || x.Id == transfer.ToLocationId))
                .ToDictionaryAsync(x => x.Id, x => x.LocationType, cancellationToken);
            SilaTransferFigures.CostBook book = await SilaTransferFigures.GetCostBookAsync(
                _repository, buyer.Id, new[] { transfer.FromLocationId, transfer.ToLocationId }, items.Select(x => x.MaterialId), cancellationToken);
            Dictionary<Guid, (decimal? Value, string? Currency)> totals = SilaTransferFigures.Totals(new[] { transfer }, items, book);
            Dictionary<Guid, string> users = await SilaMovementLookup.GetUserNamesAsync(
                _identityApiClient, _logger, events.Select(x => x.ActorUserId).Append(transfer.RequestedBy), cancellationToken);

            SilaTransferDetailDto result = new SilaTransferDetailDto
            {
                Id = transfer.Id,
                ItoNumber = transfer.ItoNumber,
                Mode = transfer.Mode,
                Status = transfer.Status,
                FromLocationId = transfer.FromLocationId,
                FromLocationName = locations.GetValueOrDefault(transfer.FromLocationId),
                ToLocationId = transfer.ToLocationId,
                ToLocationName = locations.GetValueOrDefault(transfer.ToLocationId),
                Reason = transfer.Reason,
                Comment = transfer.Comment,
                RequiredBy = transfer.RequiredBy,
                RequestedBy = transfer.RequestedBy,
                RequestedByName = SilaMovementLookup.NameOf(users, transfer.RequestedBy),
                RequestedOn = transfer.DateCreated,
                ApprovedOn = transfer.ApprovedOn,
                DispatchedOn = transfer.DispatchedOn,
                ReceivedOn = transfer.ReceivedOn,
                AlreadyCollected = transfer.AlreadyCollected,
                DisputeReason = transfer.DisputeReason,
                Items = items.Select(x => new SilaTransferItemDto
                {
                    Id = x.Id,
                    MaterialId = x.MaterialId,
                    MaterialCode = x.MaterialCode,
                    MaterialName = x.MaterialName,
                    RequestedQty = x.RequestedQty,
                    ApprovedQty = x.ApprovedQty,
                    DispatchedQty = x.DispatchedQty,
                    ReceivedQty = x.ReceivedQty,
                    Uom = x.Uom,
                    UnitCost = book.UnitCost(transfer.FromLocationId, x.MaterialId),
                    TransferValue = book.UnitCost(transfer.FromLocationId, x.MaterialId) is decimal cost
                        ? Math.Round(cost * SilaTransferFigures.EffectiveQty(x), 2)
                        : null,
                    SourceAvailable = book.OnHand(transfer.FromLocationId, x.MaterialId),
                    SourceAfter = SilaTransferFigures.BeforeDispatch(transfer)
                        ? book.OnHand(transfer.FromLocationId, x.MaterialId) - (x.ApprovedQty > 0 ? x.ApprovedQty : x.RequestedQty)
                        : book.OnHand(transfer.FromLocationId, x.MaterialId),
                    VarianceQty = transfer.ReceivedOn != null ? x.ReceivedQty - x.DispatchedQty : null
                }).ToList(),
                Events = events.Select(x => new SilaTransferEventDto
                {
                    Action = x.Action,
                    Comment = x.Comment,
                    ActorUserId = x.ActorUserId,
                    ActorName = SilaMovementLookup.NameOf(users, x.ActorUserId),
                    On = x.DateCreated
                }).ToList(),
                AllowedActions = SilaTransferRules.AllowedActions(transfer, request.UserId, locationIds),
                FromLocationType = types.GetValueOrDefault(transfer.FromLocationId),
                ToLocationType = types.GetValueOrDefault(transfer.ToLocationId),
                TransferRelationship = SilaTransferFigures.Relationship(
                    types.GetValueOrDefault(transfer.FromLocationId), types.GetValueOrDefault(transfer.ToLocationId)),
                TotalValue = totals.TryGetValue(transfer.Id, out (decimal? Value, string? Currency) total) ? total.Value : null,
                Currency = totals.TryGetValue(transfer.Id, out (decimal? Value, string? Currency) currency) ? currency.Currency : null,
                Approvals = SilaTransferApprovals.Build(transfer, items, events, book, users)
            };

            _logger.LogInfo($"Transfer fetched. TransferId: {transfer.Id}, Lines: {result.Items.Count}, Events: {result.Events.Count}");
            return result;
        }
    }
}

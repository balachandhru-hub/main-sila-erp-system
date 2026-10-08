using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaQuickTransfer
{
    /// <summary>
    /// Quick transfer, within the buyer's quick-transfer policy (enabled, maximum line quantity, outlet to outlet).
    /// - Raised at the source with manager approval skipped: created DISPATCHED (TRANSFER_OUT at the source, in transit at
    ///   the destination); the destination confirms the receipt.
    /// - Raised at the destination with manager approval skipped: created APPROVED; the source dispatches it.
    /// - Policy requires manager approval: created PENDING_APPROVAL like a standard transfer.
    /// - Already collected (raised at the destination for stock already taken): waits APPROVED for the source to confirm
    ///   the handover, or, when the policy needs no source confirmation, is booked RECEIVED at once.
    /// </summary>
    public class CreateSilaQuickTransferCommandHandler : IRequestHandler<CreateSilaQuickTransferCommand, Guid>
    {
        private const string AWAITING_HANDOVER = "AWAITING_HANDOVER";

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CreateSilaQuickTransferCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Guid> Handle(CreateSilaQuickTransferCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(CreateSilaQuickTransferCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Guid> HandleOnceAsync(CreateSilaQuickTransferCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Creating quick transfer. OrganizationId: {request.OrganizationId}, From: {request.Request.FromLocationId}, To: {request.Request.ToLocationId}, AlreadyCollected: {request.Request.AlreadyCollected}");

            SilaTransferRules.ValidateHeader(_logger, request.Request);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            (InventoryLocation from, InventoryLocation to) = await SilaTransferRules.ValidateLocationsAsync(
                _repository, _logger, buyer.Id, request.Request.FromLocationId, request.Request.ToLocationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            bool atSource = locationIds.Contains(from.Id);
            bool atDestination = locationIds.Contains(to.Id);
            bool allowed = request.Request.AlreadyCollected ? atDestination : atSource || atDestination;
            if (!allowed)
            {
                _logger.LogError($"User has no access to the quick transfer location. UserId: {request.UserId}, From: {from.Id}, To: {to.Id}");
                throw new ForBiddenCustomException(
                    "No access to this location.",
                    request.Request.AlreadyCollected
                        ? "Record collected stock for a destination location you are assigned to."
                        : "Raise quick transfers for a location you are assigned to.");
            }

            DateTime now = DateTime.UtcNow;
            InternalTransferOrder transfer = new InternalTransferOrder
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                ItoNumber = await SilaTransferRules.NextNumberAsync(_repository, buyer.Id, cancellationToken),
                Mode = Common.SILA_ITO_QUICK,
                FromLocationId = from.Id,
                ToLocationId = to.Id,
                Status = Common.SILA_ITO_PENDING_APPROVAL,
                Reason = request.Request.Reason?.Trim(),
                RequiredBy = request.Request.RequiredBy,
                RequestedBy = request.UserId,
                AlreadyCollected = request.Request.AlreadyCollected,
                IsActive = true
            };
            (List<InternalTransferOrderItem> items, Dictionary<Guid, ItemBuyerMaster> materials) = await SilaTransferRules.BuildItemsAsync(
                _repository, _logger, buyer.Id, transfer.Id, request.Request.Items, cancellationToken);

            QuickTransferPolicy policy = await SilaQuickTransferRules.GetPolicyAsync(_repository, buyer.Id, cancellationToken);
            SilaTransferFigures.CostBook book = await SilaTransferFigures.GetCostBookAsync(
                _repository, buyer.Id, new[] { from.Id }, items.Select(x => x.MaterialId), cancellationToken);
            decimal? totalValue = SilaTransferFigures.Totals(new[] { transfer }, items, book).TryGetValue(transfer.Id, out (decimal? Value, string? Currency) total)
                ? total.Value
                : null;
            SilaQuickTransferRules.Enforce(_logger, policy, from, to, items, totalValue);

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, Common.AUDIT_CREATED, transfer.Reason);
            bool approved = transfer.AlreadyCollected || policy.SkipManagerApproval;
            if (approved)
            {
                foreach (InternalTransferOrderItem item in items)
                {
                    item.ApprovedQty = item.RequestedQty;
                }

                transfer.Status = Common.SILA_ITO_APPROVED;
                transfer.ApprovedBy = request.UserId;
                transfer.ApprovedOn = now;
            }

            if (transfer.AlreadyCollected && !policy.SourceConfirmationRequired)
            {
                await SilaTransferRules.PostCollectedAsync(ledger, transfer, items, materials, cancellationToken);
                transfer.Status = Common.SILA_ITO_RECEIVED;
                transfer.DispatchedBy = request.UserId;
                transfer.DispatchedOn = now;
                transfer.ReceivedBy = request.UserId;
                transfer.ReceivedOn = now;
                ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, Common.SILA_ITO_RECEIVED, "Already collected; no source confirmation required.");
            }
            else if (transfer.AlreadyCollected)
            {
                ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, AWAITING_HANDOVER, "Already collected; waiting for the source to confirm the handover.");
            }
            else if (approved && atSource && policy.DestinationConfirmationRequired == false)
            {
                // No destination confirmation: the stock moves straight from the source to the destination.
                await SilaTransferRules.PostCollectedAsync(ledger, transfer, items, materials, cancellationToken);
                transfer.Status = Common.SILA_ITO_RECEIVED;
                transfer.DispatchedBy = request.UserId;
                transfer.DispatchedOn = now;
                transfer.ReceivedBy = request.UserId;
                transfer.ReceivedOn = now;
                ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, Common.SILA_ITO_RECEIVED, "Received at once; no destination confirmation required.");
            }
            else if (approved && atSource)
            {
                await SilaTransferRules.DispatchAsync(ledger, transfer, items, materials, cancellationToken);
                transfer.Status = Common.SILA_ITO_DISPATCHED;
                transfer.DispatchedBy = request.UserId;
                transfer.DispatchedOn = now;
                ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, Common.SILA_ITO_DISPATCHED, null);
            }
            else if (approved)
            {
                ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, Common.SILA_ITO_APPROVED, "Manager approval skipped by the quick-transfer policy.");
            }

            if (policy.ManagerNotification == true)
            {
                await ledger.RaiseAlertAsync(new InventoryAlert
                {
                    AlertType = SilaQuickTransferRules.ALERT_QUICK_TRANSFER,
                    Severity = Common.SILA_SEVERITY_MEDIUM,
                    Title = $"Quick transfer {transfer.ItoNumber}",
                    Message = $"{items.Count} line(s) from {from.LocationName} to {to.LocationName} ({transfer.Status}).",
                    LocationId = from.Id,
                    ReferenceType = Common.SILA_REF_ITO,
                    ReferenceId = transfer.Id,
                    RecommendedAction = "REVIEW_TRANSFER"
                }, cancellationToken);
            }

            _repository.InternalTransferOrder.Create(transfer);
            foreach (InternalTransferOrderItem item in items)
            {
                _repository.InternalTransferOrderItem.Create(item);
            }

            await _repository.SaveAsync();

            _logger.LogInfo($"Quick transfer created. TransferId: {transfer.Id}, ItoNumber: {transfer.ItoNumber}, Status: {transfer.Status}, Lines: {items.Count}");
            return transfer.Id;
        }
    }
}

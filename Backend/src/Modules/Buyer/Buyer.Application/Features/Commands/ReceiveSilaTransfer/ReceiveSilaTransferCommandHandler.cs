using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ReceiveSilaTransfer
{
    /// <summary>
    /// The destination confirms what arrived: TRANSFER_IN of the received quantities, the in-transit stock is cleared,
    /// a shortfall sets the transfer to DISCREPANCY with a TRANSFER_DISCREPANCY alert, and the transfer is queued for the ERP.
    /// A line that is not sent is received at its dispatched quantity.
    /// </summary>
    public class ReceiveSilaTransferCommandHandler : IRequestHandler<ReceiveSilaTransferCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ReceiveSilaTransferCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Unit> Handle(ReceiveSilaTransferCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(ReceiveSilaTransferCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Unit> HandleOnceAsync(ReceiveSilaTransferCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Receiving transfer. TransferId: {request.TransferId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InternalTransferOrder transfer = await SilaTransferRules.GetTransferAsync(_repository, _logger, buyer.Id, request.TransferId);
            SilaTransferRules.EnsureStatus(_logger, transfer, "received", Common.SILA_ITO_DISPATCHED);
            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, transfer.ToLocationId, cancellationToken);

            List<InternalTransferOrderItem> items = await SilaTransferRules.GetItemsAsync(_repository, transfer.Id, cancellationToken);
            Dictionary<Guid, decimal> quantities = SilaTransferRules.ReadQuantities(_logger, transfer, items, request.Request);
            Dictionary<Guid, ItemBuyerMaster> materials = await SilaAccess.GetMaterialsAsync(
                _repository, _logger, buyer.Id, items.Select(x => x.MaterialId), cancellationToken);

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            List<string> shortages = new List<string>();
            foreach (InternalTransferOrderItem item in items)
            {
                decimal received = quantities.TryGetValue(item.Id, out decimal sent) ? sent : item.DispatchedQty;
                if (received > item.DispatchedQty)
                {
                    _logger.LogError($"Received quantity above dispatched. TransferId: {transfer.Id}, ItemId: {item.Id}");
                    throw new BadRequestCustomException(
                        $"Received quantity of {item.MaterialName} is above the dispatched quantity.",
                        $"Receive at most {item.DispatchedQty:0.####} {item.Uom}.");
                }

                item.ReceivedQty = received;
                if (item.DispatchedQty <= 0)
                {
                    continue;
                }

                ItemBuyerMaster material = materials[item.MaterialId];
                await ledger.AddInTransitAsync(transfer.ToLocationId, material, -item.DispatchedQty, cancellationToken);
                if (received > 0)
                {
                    await ledger.PostAsync(new InventoryMovement
                    {
                        LocationId = transfer.ToLocationId,
                        Material = material,
                        Direction = Common.SILA_DIRECTION_IN,
                        TransactionType = Common.SILA_TXN_TRANSFER_IN,
                        BaseQuantity = received,
                        EnteredQuantity = received,
                        EnteredUom = item.Uom,
                        ReferenceType = Common.SILA_REF_ITO,
                        ReferenceId = transfer.Id,
                        ReferenceNumber = transfer.ItoNumber,
                        Reason = transfer.Reason
                    }, cancellationToken);
                }

                if (received < item.DispatchedQty)
                {
                    decimal shortfall = item.DispatchedQty - received;
                    shortages.Add($"{item.MaterialCode}: {shortfall:0.####} {item.Uom} short");
                    await ledger.RaiseAlertAsync(new InventoryAlert
                    {
                        AlertType = Common.SILA_ALERT_TRANSFER_DISCREPANCY,
                        Severity = Common.SILA_SEVERITY_HIGH,
                        Title = $"Transfer discrepancy: {item.MaterialName}",
                        Message = $"{transfer.ItoNumber}: dispatched {item.DispatchedQty:0.####}, received {received:0.####} {item.Uom}.",
                        LocationId = transfer.ToLocationId,
                        MaterialId = item.MaterialId,
                        ReferenceType = Common.SILA_REF_ITO,
                        ReferenceId = transfer.Id,
                        RecommendedAction = Common.SILA_ACTION_REVIEW_TRANSFER
                    }, cancellationToken);
                }
            }

            _repository.InternalTransferOrderItem.UpdateRange(items);
            transfer.Status = shortages.Count > 0 ? Common.SILA_ITO_DISCREPANCY : Common.SILA_ITO_RECEIVED;
            transfer.ReceivedBy = request.UserId;
            transfer.ReceivedOn = DateTime.UtcNow;

            ledger.QueueErpPosting(Common.SILA_REF_ITO, transfer.Id, transfer.ItoNumber, transfer.ToLocationId, Common.SILA_MOVEMENT_TRANSFER);
            List<string> notes = new List<string>();
            if (!string.IsNullOrWhiteSpace(request.Request.Comment))
            {
                notes.Add(request.Request.Comment.Trim());
            }

            if (shortages.Count > 0)
            {
                notes.Add("Discrepancy: " + string.Join("; ", shortages));
            }

            ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, transfer.Status, notes.Count == 0 ? null : string.Join(" | ", notes));
            await _repository.SaveAsync();

            _logger.LogInfo($"Transfer received. TransferId: {transfer.Id}, Status: {transfer.Status}, ShortLines: {shortages.Count}");
            return Unit.Value;
        }
    }
}

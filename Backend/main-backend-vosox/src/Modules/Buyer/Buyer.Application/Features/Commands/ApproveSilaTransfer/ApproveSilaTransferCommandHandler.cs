using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ApproveSilaTransfer
{
    /// <summary>
    /// The source location approves a pending transfer, optionally lowering the quantity of each line.
    /// A line that is not sent is approved at its requested quantity.
    /// </summary>
    public class ApproveSilaTransferCommandHandler : IRequestHandler<ApproveSilaTransferCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ApproveSilaTransferCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(ApproveSilaTransferCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Approving transfer. TransferId: {request.TransferId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InternalTransferOrder transfer = await SilaTransferRules.GetTransferAsync(_repository, _logger, buyer.Id, request.TransferId);
            SilaTransferRules.EnsureStatus(_logger, transfer, "approved", Common.SILA_ITO_PENDING_APPROVAL);
            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, transfer.FromLocationId, cancellationToken);

            List<InternalTransferOrderItem> items = await SilaTransferRules.GetItemsAsync(_repository, transfer.Id, cancellationToken);
            Dictionary<Guid, decimal> quantities = SilaTransferRules.ReadQuantities(_logger, transfer, items, request.Request);

            List<string> changes = new List<string>();
            foreach (InternalTransferOrderItem item in items)
            {
                decimal approved = quantities.TryGetValue(item.Id, out decimal sent) ? sent : item.RequestedQty;
                if (approved > item.RequestedQty)
                {
                    _logger.LogError($"Approved quantity above requested. TransferId: {transfer.Id}, ItemId: {item.Id}");
                    throw new BadRequestCustomException(
                        $"Approved quantity of {item.MaterialName} is above the requested quantity.",
                        $"Approve at most {item.RequestedQty:0.####} {item.Uom}.");
                }

                if (approved != item.RequestedQty)
                {
                    changes.Add($"{item.MaterialCode}: {item.RequestedQty:0.####} -> {approved:0.####} {item.Uom}");
                }

                item.ApprovedQty = approved;
            }

            if (items.All(x => x.ApprovedQty <= 0))
            {
                _logger.LogError($"All approved quantities are zero. TransferId: {transfer.Id}");
                throw new BadRequestCustomException("Approve at least one line.", "To refuse the whole transfer, reject it with a comment.");
            }

            _repository.InternalTransferOrderItem.UpdateRange(items);
            transfer.Status = Common.SILA_ITO_APPROVED;
            transfer.ApprovedBy = request.UserId;
            transfer.ApprovedOn = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(request.Request.Comment))
            {
                transfer.Comment = request.Request.Comment.Trim();
            }

            List<string> notes = new List<string>();
            if (!string.IsNullOrWhiteSpace(request.Request.Comment))
            {
                notes.Add(request.Request.Comment.Trim());
            }

            if (changes.Count > 0)
            {
                notes.Add("Quantity changed: " + string.Join("; ", changes));
            }

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, Common.SILA_ITO_APPROVED, notes.Count == 0 ? null : string.Join(" | ", notes));
            await _repository.SaveAsync();

            _logger.LogInfo($"Transfer approved. TransferId: {transfer.Id}, ChangedLines: {changes.Count}");
            return Unit.Value;
        }
    }
}

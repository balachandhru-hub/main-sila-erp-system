using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
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
            bool chained = await _repository.SilaApprovalStep
                .FindByCondition(x => x.ReferenceType == Common.SILA_REF_ITO && x.ReferenceId == transfer.Id && x.Version == 1 && x.IsActive)
                .AnyAsync(cancellationToken);
            if (chained)
            {
                await EnsureEitherLocationAsync(buyer.Id, request.UserId, request.RoleId, transfer, cancellationToken);
                ApprovalDecision decision = await SilaApprovals.DecideAsync(
                    _repository, _logger, Common.SILA_REF_ITO, transfer.Id, 1, request.UserId, true, request.Request.Comment, cancellationToken,
                    SilaAccess.IsAdministrator(request.RoleId));
                if (decision.Outcome == SilaApprovals.OUTCOME_PENDING)
                {
                    InventoryLedger waiting = new InventoryLedger(_repository, buyer.Id, request.UserId);
                    waiting.AddEvent(Common.SILA_REF_ITO, transfer.Id, "APPROVAL_LEVEL", $"Level {decision.Level} approved.");
                    await _repository.SaveAsync();
                    _logger.LogInfo($"Transfer approval advanced. TransferId: {transfer.Id}, Level: {decision.Level}");
                    return Unit.Value;
                }
            }
            else
            {
                await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, transfer.FromLocationId, cancellationToken);
            }

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

        private async Task EnsureEitherLocationAsync(Guid buyerId, Guid userId, Guid roleId, InternalTransferOrder transfer, CancellationToken cancellationToken)
        {
            List<Guid> mine = await SilaAccess.GetLocationIdsAsync(_repository, buyerId, userId, roleId, cancellationToken);
            if (!mine.Contains(transfer.FromLocationId) && !mine.Contains(transfer.ToLocationId))
            {
                _logger.LogError($"User has no access to the transfer locations. TransferId: {transfer.Id}, UserId: {userId}");
                throw new ForBiddenCustomException("No access to this transfer.", "Approve a transfer for a location you are assigned to.");
            }
        }
    }
}

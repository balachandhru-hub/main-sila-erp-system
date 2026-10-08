using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ConfirmSilaTransferHandover
{
    /// <summary>
    /// The source location confirms that the requester took the stock of an already-collected quick transfer: TRANSFER_OUT
    /// at the source, TRANSFER_IN at the destination, the transfer is RECEIVED and queued for the ERP.
    /// </summary>
    public class ConfirmSilaTransferHandoverCommandHandler : IRequestHandler<ConfirmSilaTransferHandoverCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ConfirmSilaTransferHandoverCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Unit> Handle(ConfirmSilaTransferHandoverCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(ConfirmSilaTransferHandoverCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Unit> HandleOnceAsync(ConfirmSilaTransferHandoverCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Confirming transfer handover. TransferId: {request.TransferId}, UserId: {request.UserId}");

            SilaTransferRules.ValidateComment(_logger, request.Request.Comment);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InternalTransferOrder transfer = await SilaTransferRules.GetTransferAsync(_repository, _logger, buyer.Id, request.TransferId);
            if (!transfer.AlreadyCollected)
            {
                _logger.LogError($"Handover confirmation of a transfer that was not collected. TransferId: {transfer.Id}");
                throw new BadRequestCustomException("The transfer was not recorded as already collected.", "Dispatch the transfer instead.");
            }

            SilaTransferRules.EnsureStatus(_logger, transfer, "confirmed", Common.SILA_ITO_APPROVED);
            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, transfer.FromLocationId, cancellationToken);

            List<InternalTransferOrderItem> items = await SilaTransferRules.GetItemsAsync(_repository, transfer.Id, cancellationToken);
            Dictionary<Guid, ItemBuyerMaster> materials = await SilaAccess.GetMaterialsAsync(
                _repository, _logger, buyer.Id, items.Select(x => x.MaterialId), cancellationToken);

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            await SilaTransferRules.PostCollectedAsync(ledger, transfer, items, materials, cancellationToken);
            _repository.InternalTransferOrderItem.UpdateRange(items);

            DateTime now = DateTime.UtcNow;
            transfer.Status = Common.SILA_ITO_RECEIVED;
            transfer.DispatchedBy = request.UserId;
            transfer.DispatchedOn = now;
            transfer.ReceivedBy = transfer.RequestedBy;
            transfer.ReceivedOn = now;
            string? comment = string.IsNullOrWhiteSpace(request.Request.Comment) ? null : request.Request.Comment.Trim();
            ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, SilaTransferRules.ACTION_CONFIRM_HANDOVER, comment);
            await _repository.SaveAsync();

            _logger.LogInfo($"Transfer handover confirmed. TransferId: {transfer.Id}, Lines: {items.Count}");
            return Unit.Value;
        }
    }
}

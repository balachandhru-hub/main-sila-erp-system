using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DispatchSilaTransfer
{
    /// <summary>
    /// The source location sends an approved transfer: the approved quantities leave the source (TRANSFER_OUT)
    /// and are in transit at the destination.
    /// </summary>
    public class DispatchSilaTransferCommandHandler : IRequestHandler<DispatchSilaTransferCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DispatchSilaTransferCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Unit> Handle(DispatchSilaTransferCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(DispatchSilaTransferCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Unit> HandleOnceAsync(DispatchSilaTransferCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Dispatching transfer. TransferId: {request.TransferId}, UserId: {request.UserId}");

            SilaTransferRules.ValidateComment(_logger, request.Request.Comment);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InternalTransferOrder transfer = await SilaTransferRules.GetTransferAsync(_repository, _logger, buyer.Id, request.TransferId);
            SilaTransferRules.EnsureStatus(_logger, transfer, "dispatched", Common.SILA_ITO_APPROVED);
            if (transfer.AlreadyCollected)
            {
                _logger.LogError($"Dispatch of an already-collected transfer. TransferId: {transfer.Id}");
                throw new BadRequestCustomException(
                    "The stock was already collected.",
                    "Confirm the handover, or dispute it if the stock was not taken.");
            }
            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, transfer.FromLocationId, cancellationToken);

            List<InternalTransferOrderItem> items = await SilaTransferRules.GetItemsAsync(_repository, transfer.Id, cancellationToken);
            Dictionary<Guid, ItemBuyerMaster> materials = await SilaAccess.GetMaterialsAsync(
                _repository, _logger, buyer.Id, items.Select(x => x.MaterialId), cancellationToken);

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            await SilaTransferRules.DispatchAsync(ledger, transfer, items, materials, cancellationToken);
            _repository.InternalTransferOrderItem.UpdateRange(items);

            transfer.Status = Common.SILA_ITO_DISPATCHED;
            transfer.DispatchedBy = request.UserId;
            transfer.DispatchedOn = DateTime.UtcNow;
            ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, Common.SILA_ITO_DISPATCHED, request.Request.Comment?.Trim());
            await _repository.SaveAsync();

            _logger.LogInfo($"Transfer dispatched. TransferId: {transfer.Id}, Lines: {items.Count(x => x.DispatchedQty > 0)}");
            return Unit.Value;
        }
    }
}

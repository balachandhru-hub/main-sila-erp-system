using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CancelSilaTransfer
{
    /// <summary>The requester withdraws a transfer that has not been dispatched yet.</summary>
    public class CancelSilaTransferCommandHandler : IRequestHandler<CancelSilaTransferCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CancelSilaTransferCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(CancelSilaTransferCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Cancelling transfer. TransferId: {request.TransferId}, UserId: {request.UserId}");

            SilaTransferRules.ValidateComment(_logger, request.Request.Comment);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InternalTransferOrder transfer = await SilaTransferRules.GetTransferAsync(_repository, _logger, buyer.Id, request.TransferId);
            if (transfer.RequestedBy != request.UserId)
            {
                _logger.LogError($"Only the requester can cancel the transfer. TransferId: {transfer.Id}, UserId: {request.UserId}");
                throw new ForBiddenCustomException("Only the requester can cancel this transfer.", "Ask the user who requested the transfer to cancel it.");
            }

            SilaTransferRules.EnsureStatus(_logger, transfer, "cancelled", Common.SILA_ITO_PENDING_APPROVAL, Common.SILA_ITO_APPROVED);

            string? comment = request.Request.Comment?.Trim();
            transfer.Status = Common.SILA_ITO_CANCELLED;
            if (!string.IsNullOrWhiteSpace(comment))
            {
                transfer.Comment = comment;
            }

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, Common.SILA_ITO_CANCELLED, comment);
            await _repository.SaveAsync();

            _logger.LogInfo($"Transfer cancelled. TransferId: {transfer.Id}");
            return Unit.Value;
        }
    }
}

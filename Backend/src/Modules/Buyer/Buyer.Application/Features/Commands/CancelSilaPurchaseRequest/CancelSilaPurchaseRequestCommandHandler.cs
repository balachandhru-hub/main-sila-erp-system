using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CancelSilaPurchaseRequest
{
    /// <summary>Cancels a submitted purchase request of a location the user works with.</summary>
    public class CancelSilaPurchaseRequestCommandHandler : IRequestHandler<CancelSilaPurchaseRequestCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CancelSilaPurchaseRequestCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(CancelSilaPurchaseRequestCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Cancelling purchase request. RequestId: {request.PurchaseRequestId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InternalPurchaseRequest purchaseRequest = await SilaPurchaseRequestRules.GetAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.PurchaseRequestId, cancellationToken);
            SilaPurchaseRequestRules.EnsureSubmitted(_logger, purchaseRequest, "cancelled");

            purchaseRequest.Status = Common.SILA_PR_CANCELLED;
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_PURCHASE_REQUEST, purchaseRequest.Id, Common.SILA_PR_CANCELLED, null);
            await _repository.SaveAsync();

            _logger.LogInfo($"Purchase request cancelled. RequestId: {purchaseRequest.Id}");
            return Unit.Value;
        }
    }
}

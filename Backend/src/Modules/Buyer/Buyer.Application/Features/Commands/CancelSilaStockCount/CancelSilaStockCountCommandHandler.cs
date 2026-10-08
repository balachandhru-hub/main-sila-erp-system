using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CancelSilaStockCount
{
    public class CancelSilaStockCountCommandHandler : IRequestHandler<CancelSilaStockCountCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CancelSilaStockCountCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(CancelSilaStockCountCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Cancelling stock count. StockCountId: {request.StockCountId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockCount count = await SilaStockCountRules.GetCountAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.StockCountId, cancellationToken);
            SilaStockCountRules.EnsureInProgress(count, _logger);

            count.Status = Common.SILA_COUNT_CANCELLED;
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_STOCK_COUNT, count.Id, SilaStockCountRules.EVENT_CANCELLED, null);
            await SilaPhysicalInventoryRules.CloseForCountAsync(_repository, ledger, count, Common.SILA_PI_CANCELLED, cancellationToken);
            await _repository.SaveAsync();

            _logger.LogInfo($"Stock count cancelled. StockCountId: {count.Id}");
            return Unit.Value;
        }
    }
}

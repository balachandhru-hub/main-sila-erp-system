using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaStockCount
{
    public class CreateSilaStockCountCommandHandler : IRequestHandler<CreateSilaStockCountCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CreateSilaStockCountCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Guid> Handle(CreateSilaStockCountCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(CreateSilaStockCountCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Guid> HandleOnceAsync(CreateSilaStockCountCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo(
                $"Creating stock count. LocationId: {request.Request.LocationId}, CountType: {request.Request.CountType}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            StockCount count = await SilaStockCountRules.CreateCountAsync(
                _repository,
                _logger,
                ledger,
                buyer.Id,
                request.UserId,
                request.RoleId,
                request.Request.LocationId,
                request.Request.CountType,
                request.Request.BlindCount,
                request.Request.Notes,
                cancellationToken,
                request.Request.BusinessDate);
            await _repository.SaveAsync();

            _logger.LogInfo($"Stock count created. StockCountId: {count.Id}, CountNumber: {count.CountNumber}");
            return count.Id;
        }
    }
}

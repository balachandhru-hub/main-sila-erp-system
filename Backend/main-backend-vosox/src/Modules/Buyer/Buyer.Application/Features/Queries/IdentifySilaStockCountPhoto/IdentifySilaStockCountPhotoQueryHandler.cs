using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.IdentifySilaStockCountPhoto
{
    /// <summary>
    /// Asks the photo identifier for material candidates. The user must confirm a candidate before counting.
    /// Inventory is not changed.
    /// </summary>
    public class IdentifySilaStockCountPhotoQueryHandler : IRequestHandler<IdentifySilaStockCountPhotoQuery, SilaStockCountPhotoIdentifyDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public IdentifySilaStockCountPhotoQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaStockCountPhotoIdentifyDto> Handle(IdentifySilaStockCountPhotoQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Identifying material from photo. StockCountId: {request.StockCountId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockCount count = await SilaStockCountRules.GetCountAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.StockCountId, cancellationToken);

            SilaStockCountPhotoIdentifyDto result = SilaMaterialPhotoIdentifier.Identify();
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(
                Common.SILA_REF_STOCK_COUNT,
                count.Id,
                "PHOTO_IDENTIFY",
                result.Configured ? $"Candidates={result.Candidates.Count}" : "Provider not configured. No material selected.");
            await _repository.SaveAsync();

            _logger.LogInfo($"Photo identification finished. StockCountId: {count.Id}, Configured: {result.Configured}, Candidates: {result.Candidates.Count}");
            return result;
        }
    }
}

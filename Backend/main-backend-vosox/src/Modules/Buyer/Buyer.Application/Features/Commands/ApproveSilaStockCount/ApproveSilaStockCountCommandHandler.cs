using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ApproveSilaStockCount
{
    public class ApproveSilaStockCountCommandHandler : IRequestHandler<ApproveSilaStockCountCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ApproveSilaStockCountCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Unit> Handle(ApproveSilaStockCountCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(ApproveSilaStockCountCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Unit> HandleOnceAsync(ApproveSilaStockCountCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Approving stock count. StockCountId: {request.StockCountId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockCount count = await SilaStockCountRules.GetCountAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.StockCountId, cancellationToken);
            if (count.Status != Common.SILA_COUNT_SUBMITTED && count.Status != Common.SILA_COUNT_ENQUIRY_PENDING)
            {
                _logger.LogError($"Stock count cannot be approved. StockCountId: {count.Id}, Status: {count.Status}");
                throw new BadRequestCustomException("Stock count cannot be approved.", $"Count {count.CountNumber} is {count.Status}. Only a submitted count can be approved.");
            }

            int openEnquiries = await _repository.StockShortageEnquiry
                .FindByCondition(x => x.StockCountId == count.Id
                    && x.IsActive
                    && x.Status != Common.SILA_ENQUIRY_ACCEPTED
                    && x.Status != Common.SILA_ENQUIRY_REJECTED)
                .CountAsync(cancellationToken);
            if (openEnquiries > 0)
            {
                _logger.LogError($"Stock count has open enquiries. StockCountId: {count.Id}, Open: {openEnquiries}");
                throw new BadRequestCustomException(
                    $"{openEnquiries} shortage enquiries are still open.",
                    "Accept or reject every shortage enquiry of this count before approving it.");
            }

            // Lines the cost controller rejected are not posted; every other variance is accepted with the count.
            List<StockCountItem> variances = await _repository.StockCountItem
                .FindByCondition(x => x.StockCountId == count.Id
                    && x.IsActive
                    && x.VarianceQty != null
                    && x.VarianceQty != 0
                    && (x.ReviewStatus == null || x.ReviewStatus != SilaStockCountRules.LINE_REVIEW_REJECTED))
                .ToListAsync(cancellationToken);
            List<Guid> materialIds = variances.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = await _repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyer.Id && materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            foreach (StockCountItem item in variances)
            {
                if (!materials.TryGetValue(item.MaterialId, out ItemBuyerMaster? material))
                {
                    _logger.LogError($"Material of the count line not found. MaterialId: {item.MaterialId}, StockCountId: {count.Id}");
                    throw new NotFoundCustomException("Material not found.", $"Material {item.MaterialCode} no longer exists in the Item Master.");
                }

                decimal variance = item.VarianceQty ?? 0;
                await ledger.PostAsync(new InventoryMovement
                {
                    LocationId = count.LocationId,
                    Material = material,
                    Direction = variance > 0 ? Common.SILA_DIRECTION_IN : Common.SILA_DIRECTION_OUT,
                    TransactionType = Common.SILA_TXN_STOCK_COUNT_ADJUSTMENT,
                    BaseQuantity = Math.Abs(variance),
                    EnteredQuantity = Math.Abs(variance),
                    EnteredUom = item.BaseUom,
                    UnitCost = item.UnitCost,
                    ReferenceType = Common.SILA_REF_STOCK_COUNT,
                    ReferenceId = count.Id,
                    ReferenceNumber = count.CountNumber,
                    Reason = "Stock count variance",
                    BusinessDate = count.BusinessDate
                }, cancellationToken);
            }

            if (variances.Count > 0)
            {
                ledger.QueueErpPosting(Common.SILA_REF_STOCK_COUNT, count.Id, count.CountNumber, count.LocationId, Common.SILA_MOVEMENT_STOCK_COUNT);
            }

            count.Status = Common.SILA_COUNT_POSTED;
            count.ApprovedBy = request.UserId;
            count.ApprovedOn = DateTime.UtcNow;
            ledger.AddEvent(Common.SILA_REF_STOCK_COUNT, count.Id, SilaStockCountRules.EVENT_APPROVED, $"Adjustments={variances.Count}");
            await SilaPhysicalInventoryRules.CloseForCountAsync(_repository, ledger, count, Common.SILA_PI_COMPLETED, cancellationToken);
            await _repository.SaveAsync();

            _logger.LogInfo($"Stock count approved and posted. StockCountId: {count.Id}, Adjustments: {variances.Count}");
            return Unit.Value;
        }
    }
}

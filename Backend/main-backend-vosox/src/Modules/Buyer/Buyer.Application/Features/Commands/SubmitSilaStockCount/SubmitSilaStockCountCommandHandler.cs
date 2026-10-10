using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SubmitSilaStockCount
{
    public class SubmitSilaStockCountCommandHandler : IRequestHandler<SubmitSilaStockCountCommand, Unit>
    {
        private const string ENQUIRY_EVENT_SENT = "SENT";

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SubmitSilaStockCountCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Unit> Handle(SubmitSilaStockCountCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(SubmitSilaStockCountCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Unit> HandleOnceAsync(SubmitSilaStockCountCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo(
                $"Submitting stock count. StockCountId: {request.StockCountId}, CountMissingAsZero: {request.Request.CountMissingAsZero}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockCount count = await SilaStockCountRules.GetCountAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.StockCountId, cancellationToken);
            SilaStockCountRules.EnsureInProgress(count, _logger);

            List<StockCountItem> items = await _repository.StockCountItem
                .FindByCondition(x => x.StockCountId == count.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            if (items.Count == 0)
            {
                _logger.LogError($"Stock count has no lines. StockCountId: {count.Id}");
                throw new BadRequestCustomException("Nothing was counted.", "Scan or search at least one material before submitting the count.");
            }

            List<StockCountItem> uncounted = items.Where(x => x.Status == Common.SILA_COUNT_LINE_NOT_COUNTED).ToList();
            if (uncounted.Count > 0 && !request.Request.CountMissingAsZero)
            {
                _logger.LogError($"Stock count has uncounted lines. StockCountId: {count.Id}, Uncounted: {uncounted.Count}");
                throw new BadRequestCustomException(
                    $"{uncounted.Count} materials are still uncounted.",
                    "Count the remaining materials, or submit again choosing to record them as counted 0.");
            }

            foreach (StockCountItem item in uncounted)
            {
                SilaStockCountRules.ApplyCount(item, 0, SilaStockCountRules.METHOD_MANUAL, request.UserId);
                _repository.StockCountItem.Update(item);
            }

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            bool managerConfigured = await _repository.InventoryLocationUserMapping
                .FindByCondition(x => x.LocationId == count.LocationId && x.IsActive)
                .AnyAsync(cancellationToken);
            string managerNote = managerConfigured ? "Sent to the location manager." : "MANAGER NOT CONFIGURED";
            // A count resubmitted after a recount keeps the enquiries of the lines that were not recounted.
            List<StockShortageEnquiry> existingEnquiries = await _repository.StockShortageEnquiry
                .FindByCondition(x => x.StockCountId == count.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            HashSet<Guid> enquiredItemIds = existingEnquiries.Select(x => x.StockCountItemId).ToHashSet();
            int openEnquiries = existingEnquiries.Count(x => x.Status != Common.SILA_ENQUIRY_ACCEPTED && x.Status != Common.SILA_ENQUIRY_REJECTED);
            List<StockCountItem> shortages = items
                .Where(x => x.Status == Common.SILA_COUNT_LINE_SHORTAGE && !enquiredItemIds.Contains(x.Id))
                .ToList();
            foreach (StockCountItem item in shortages)
            {
                decimal shortageQty = -(item.VarianceQty ?? 0);
                StockShortageEnquiry enquiry = new StockShortageEnquiry
                {
                    Id = Guid.NewGuid(),
                    BuyerId = buyer.Id,
                    EnquiryNumber = await DocumentNumber.NextAsync(_repository, buyer.Id, DocumentNumber.SHORTAGE_ENQUIRY, 6, cancellationToken),
                    StockCountId = count.Id,
                    StockCountItemId = item.Id,
                    MaterialId = item.MaterialId,
                    MaterialCode = item.MaterialCode,
                    MaterialName = item.MaterialName,
                    LocationId = count.LocationId,
                    ShortageQty = shortageQty,
                    Uom = item.BaseUom,
                    Status = Common.SILA_ENQUIRY_SENT,
                    IsActive = true
                };
                _repository.StockShortageEnquiry.Create(enquiry);
                ledger.AddEvent(Common.SILA_REF_ENQUIRY, enquiry.Id, ENQUIRY_EVENT_SENT, $"{count.CountNumber}: short {shortageQty:0.####} {item.BaseUom}");
                await ledger.RaiseAlertAsync(new InventoryAlert
                {
                    AlertType = Common.SILA_ALERT_INVENTORY_VARIANCE,
                    Severity = Common.SILA_SEVERITY_MEDIUM,
                    Title = $"Count shortage: {item.MaterialName}",
                    Message = $"{count.CountNumber} found {shortageQty:0.####} {item.BaseUom} less than the system quantity. Enquiry {enquiry.EnquiryNumber}. {managerNote}",
                    LocationId = count.LocationId,
                    MaterialId = item.MaterialId,
                    ReferenceType = Common.SILA_REF_STOCK_COUNT,
                    ReferenceId = count.Id,
                    RecommendedAction = Common.SILA_ACTION_REQUEST_PHYSICAL_INVENTORY
                }, cancellationToken);
            }

            count.Status = shortages.Count + openEnquiries > 0 ? Common.SILA_COUNT_ENQUIRY_PENDING : Common.SILA_COUNT_SUBMITTED;
            count.SubmittedBy = request.UserId;
            count.SubmittedOn = DateTime.UtcNow;
            ledger.AddEvent(
                Common.SILA_REF_STOCK_COUNT,
                count.Id,
                SilaStockCountRules.EVENT_SUBMITTED,
                $"Lines={items.Count} CountedAsZero={uncounted.Count} Shortages={shortages.Count}");
            await _repository.SaveAsync();

            _logger.LogInfo($"Stock count submitted. StockCountId: {count.Id}, Status: {count.Status}, Enquiries: {shortages.Count}");
            return Unit.Value;
        }
    }
}

using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaStockCountTasks
{
    public class GetSilaStockCountTasksQueryHandler : IRequestHandler<GetSilaStockCountTasksQuery, List<SilaStockCountTaskDto>>
    {
        private const string TASK_STOCK_COUNT = "STOCK_COUNT";
        private const string TASK_SHORTAGE_ENQUIRY = "SHORTAGE_ENQUIRY";

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaStockCountTasksQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaStockCountTaskDto>> Handle(GetSilaStockCountTasksQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching stock count tasks. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            List<StockCount> counts = await _repository.StockCount
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Status == Common.SILA_COUNT_IN_PROGRESS && locationIds.Contains(x.LocationId))
                .OrderBy(x => x.DateCreated)
                .Take(SilaInputRules.MAX_LIMIT)
                .ToListAsync(cancellationToken);
            List<Guid> countIds = counts.Select(x => x.Id).ToList();
            Dictionary<Guid, int> remainingByCount = await _repository.StockCountItem
                .FindByCondition(x => countIds.Contains(x.StockCountId) && x.IsActive && x.Status == Common.SILA_COUNT_LINE_NOT_COUNTED)
                .GroupBy(x => x.StockCountId)
                .Select(x => new { StockCountId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.StockCountId, x => x.Count, cancellationToken);
            List<StockShortageEnquiry> enquiries = await _repository.StockShortageEnquiry
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && (x.Status == Common.SILA_ENQUIRY_SENT || x.Status == Common.SILA_ENQUIRY_MORE_INFORMATION) && locationIds.Contains(x.LocationId))
                .OrderBy(x => x.DateCreated)
                .Take(SilaInputRules.MAX_LIMIT)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, string> locationNames = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && locationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.LocationName, cancellationToken);

            List<SilaStockCountTaskDto> tasks = new List<SilaStockCountTaskDto>();
            foreach (StockCount count in counts)
            {
                int remaining = remainingByCount.GetValueOrDefault(count.Id);
                tasks.Add(new SilaStockCountTaskDto
                {
                    TaskType = TASK_STOCK_COUNT,
                    ReferenceId = count.Id,
                    StockCountId = count.Id,
                    Number = count.CountNumber,
                    LocationName = locationNames.TryGetValue(count.LocationId, out string? name) ? name : null,
                    Detail = SilaStockCountRules.IsReopened(count)
                        ? $"Recount requested, {remaining} lines to recount"
                        : $"{count.CountType} count, {remaining} left to count",
                    Status = count.Status,
                    DateCreated = count.DateCreated
                });
            }

            foreach (StockShortageEnquiry enquiry in enquiries)
            {
                tasks.Add(new SilaStockCountTaskDto
                {
                    TaskType = TASK_SHORTAGE_ENQUIRY,
                    ReferenceId = enquiry.Id,
                    StockCountId = enquiry.StockCountId,
                    Number = enquiry.EnquiryNumber,
                    LocationName = locationNames.TryGetValue(enquiry.LocationId, out string? name) ? name : null,
                    Detail = $"{enquiry.MaterialName}: short {enquiry.ShortageQty:0.####} {enquiry.Uom}",
                    Status = enquiry.Status,
                    DateCreated = enquiry.DateCreated
                });
            }

            _logger.LogInfo($"Stock count tasks fetched. Counts: {counts.Count}, Enquiries: {enquiries.Count}");
            return tasks;
        }
    }
}

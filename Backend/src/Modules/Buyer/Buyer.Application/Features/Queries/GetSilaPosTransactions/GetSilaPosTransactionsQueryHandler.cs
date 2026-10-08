using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPosTransactions
{
    /// <summary>
    /// The transaction tracker: each POS sale with its three steps (received, inventory deducted, posted to the ERP).
    /// A deducted sale shows POSTED or FAILED once the InventoryErpPostingJob has posted it or failed.
    /// </summary>
    public class GetSilaPosTransactionsQueryHandler : IRequestHandler<GetSilaPosTransactionsQuery, SilaPosTransactionPageDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaPosTransactionsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaPosTransactionPageDto> Handle(GetSilaPosTransactionsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching POS transactions. OrganizationId: {request.OrganizationId}, Status: {request.Status}, BusinessDate: {request.BusinessDate}, Search: {request.Search}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Guid buyerId = buyer.Id;
            IQueryable<InventoryErpPosting> postings = _repository.InventoryErpPosting.FindByCondition(x => x.BuyerId == buyerId);
            IQueryable<PosSalesTransaction> query = _repository.PosSalesTransaction.FindByCondition(x => x.BuyerId == buyerId && x.IsActive);

            if (request.BusinessDate != null)
            {
                DateTime from = request.BusinessDate.Value.Date;
                DateTime to = from.AddDays(1);
                query = query.Where(x => x.BusinessDate >= from && x.BusinessDate < to);
            }

            if (request.OutletLocationId != null)
            {
                query = query.Where(x => x.OutletLocationId == request.OutletLocationId);
            }

            if (request.BatchId != null)
            {
                query = query.Where(x => x.BatchId == request.BatchId);
            }
            else
            {
                // Lines of an upload still in preview are not sales yet.
                IQueryable<Guid> previewBatchIds = _repository.PosSalesBatch
                    .FindByCondition(x => x.BuyerId == buyerId && x.Status == Common.SILA_POS_BATCH_PREVIEW)
                    .Select(x => x.Id);
                query = query.Where(x => x.BatchId == null || !previewBatchIds.Contains(x.BatchId.Value));
            }

            if (!SilaAccess.HasFullAccess(request.RoleId))
            {
                List<Guid> allowed = await SilaAccess.GetLocationIdsAsync(_repository, buyerId, request.UserId, request.RoleId, cancellationToken);
                query = query.Where(x => x.OutletLocationId != null && allowed.Contains(x.OutletLocationId.Value));
            }

            if (request.MaterialId != null)
            {
                Guid materialId = request.MaterialId.Value;
                IQueryable<Guid> consumedBy = _repository.InventoryTransaction
                    .FindByCondition(x => x.BuyerId == buyerId && x.ReferenceType == Common.SILA_REF_POS_SALE && x.MaterialId == materialId)
                    .Select(x => x.ReferenceId);
                query = query.Where(x => consumedBy.Contains(x.Id));
            }

            string postingStatus = string.IsNullOrWhiteSpace(request.PostingStatus)
                ? string.Empty
                : SilaInputRules.OneOf(_logger, request.PostingStatus, new[]
                {
                    Common.SILA_POSTING_PENDING, Common.SILA_POSTING_POSTED, Common.SILA_POSTING_FAILED,
                    Common.SILA_POSTING_SKIPPED, Common.SILA_POSTING_UNKNOWN
                }, "posting status");
            if (postingStatus.Length > 0)
            {
                query = query.Where(x => postings.Any(p => p.Id == x.ErpPostingId && p.Status == postingStatus));
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                query = query.Where(x => x.SourceTransactionId.Contains(search) || x.PosCode.Contains(search) || x.OutletCode.Contains(search));
            }

            string status = string.IsNullOrWhiteSpace(request.Status)
                ? string.Empty
                : SilaInputRules.OneOf(_logger, request.Status, new[]
                {
                    Common.SILA_POS_RECEIVED, Common.SILA_POS_INVENTORY_DEDUCTED, Common.SILA_POS_POSTED, Common.SILA_POS_FAILED
                }, "POS status");
            if (status == Common.SILA_POS_POSTED)
            {
                query = query.Where(x => x.Status == Common.SILA_POS_POSTED
                    || (x.Status == Common.SILA_POS_INVENTORY_DEDUCTED && postings.Any(p => p.Id == x.ErpPostingId && p.Status == Common.SILA_POSTING_POSTED)));
            }
            else if (status == Common.SILA_POS_FAILED)
            {
                query = query.Where(x => x.Status == Common.SILA_POS_FAILED
                    || (x.Status == Common.SILA_POS_INVENTORY_DEDUCTED && postings.Any(p => p.Id == x.ErpPostingId && p.Status == Common.SILA_POSTING_FAILED)));
            }
            else if (status == Common.SILA_POS_INVENTORY_DEDUCTED)
            {
                query = query.Where(x => x.Status == Common.SILA_POS_INVENTORY_DEDUCTED
                    && !postings.Any(p => p.Id == x.ErpPostingId && (p.Status == Common.SILA_POSTING_POSTED || p.Status == Common.SILA_POSTING_FAILED)));
            }
            else if (status.Length > 0)
            {
                query = query.Where(x => x.Status == status);
            }

            int limit = SilaInputRules.Limit(request.Limit, 20);
            int index = Math.Max(0, request.Index);
            int total = await query.CountAsync(cancellationToken);
            List<PosSalesTransaction> page = await query
                .OrderByDescending(x => x.BusinessDate)
                .ThenByDescending(x => x.DateCreated)
                .ThenBy(x => x.SourceTransactionId)
                .ThenBy(x => x.LineNumber)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);

            List<Guid> postingIds = page.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            Dictionary<Guid, InventoryErpPosting> postingById = await postings
                .Where(x => postingIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            List<Guid> locationIds = page.Where(x => x.OutletLocationId != null).Select(x => x.OutletLocationId!.Value).Distinct().ToList();
            var locationRows = await _repository.InventoryLocation
                .FindByCondition(x => locationIds.Contains(x.Id))
                .Select(x => new { x.Id, x.LocationName, x.LocationType })
                .ToListAsync(cancellationToken);
            Dictionary<Guid, string> locationNames = locationRows.ToDictionary(x => x.Id, x => x.LocationName);
            Dictionary<Guid, string?> locationTypes = locationRows.ToDictionary(x => x.Id, x => (string?)x.LocationType);
            List<Guid> recipeIds = page.Where(x => x.RecipeId != null).Select(x => x.RecipeId!.Value).Distinct().ToList();
            Dictionary<Guid, Recipe> recipes = await _repository.Recipe
                .FindByCondition(x => recipeIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            List<Guid?> batchIds = page.Select(x => x.BatchId).Where(x => x != null).Distinct().ToList();
            Dictionary<Guid, string> batchNumbers = await _repository.PosSalesBatch
                .FindByCondition(x => batchIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.BatchNumber, cancellationToken);

            SilaPosTransactionPageDto result = new SilaPosTransactionPageDto
            {
                Total = total,
                Index = index,
                Limit = limit,
                Items = page.Select(x => SilaPosTracker.ToDto(
                    x,
                    x.ErpPostingId != null && postingById.TryGetValue(x.ErpPostingId.Value, out InventoryErpPosting? posting) ? posting : null,
                    x.OutletLocationId != null && locationNames.TryGetValue(x.OutletLocationId.Value, out string? location) ? location : null,
                    x.RecipeId != null && recipes.TryGetValue(x.RecipeId.Value, out Recipe? recipe) ? recipe : null,
                    x.BatchId != null && batchNumbers.TryGetValue(x.BatchId.Value, out string? batch) ? batch : null,
                    x.OutletLocationId != null && locationTypes.TryGetValue(x.OutletLocationId.Value, out string? type) ? type : null)).ToList()
            };

            // Consumption transaction number of each sale on the page (one grouped lookup).
            List<Guid> saleIds = page.Select(x => x.Id).ToList();
            Dictionary<Guid, string> consumptionNumbers = (await _repository.InventoryTransaction
                .FindByCondition(x => x.BuyerId == buyer.Id && x.ReferenceType == Common.SILA_REF_POS_SALE && saleIds.Contains(x.ReferenceId))
                .Select(x => new { x.ReferenceId, x.TransactionNumber, x.DateCreated })
                .ToListAsync(cancellationToken))
                .GroupBy(x => x.ReferenceId)
                .ToDictionary(x => x.Key, x => x.OrderBy(y => y.DateCreated).First().TransactionNumber);
            foreach (SilaPosTransactionDto item in result.Items)
            {
                item.ConsumptionTransactionNumber = consumptionNumbers.GetValueOrDefault(item.Id);
            }

            _logger.LogInfo($"POS transactions fetched. Total: {total}, Page: {result.Items.Count}");
            return result;
        }
    }
}

using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The ERP (SAP) posting of stock count variances: an approved count queues one posting that carries every line with
    /// a variance that was not rejected. A line's SAP status is the status of that posting.
    /// </summary>
    public static class SilaCountPosting
    {
        /// <summary>The latest ERP posting of each count, in one query.</summary>
        public static async Task<Dictionary<Guid, InventoryErpPosting>> GetPostingsAsync(
            IRepositoryWrapper repository, Guid buyerId, IEnumerable<Guid> countIds, CancellationToken cancellationToken)
        {
            List<Guid> ids = countIds.Distinct().ToList();
            if (ids.Count == 0)
            {
                return new Dictionary<Guid, InventoryErpPosting>();
            }

            return (await repository.InventoryErpPosting
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.ReferenceType == Common.SILA_REF_STOCK_COUNT && ids.Contains(x.ReferenceId))
                    .ToListAsync(cancellationToken))
                .GroupBy(x => x.ReferenceId)
                .ToDictionary(x => x.Key, x => x.OrderByDescending(p => p.DateCreated).First());
        }

        /// <summary>True when the line's variance went (or goes) to the ERP with the count posting.</summary>
        public static bool IsPostedLine(StockCount count, StockCountItem item)
        {
            return count.Status == Common.SILA_COUNT_POSTED
                && item.VarianceQty != null
                && item.VarianceQty != 0
                && item.ReviewStatus != SilaStockCountRules.LINE_REVIEW_REJECTED;
        }

        /// <summary>SAP status, material document and error of a line; all null when the line is not posted.</summary>
        public static (string? Status, string? Document, string? Error) Of(
            StockCount count, StockCountItem item, Dictionary<Guid, InventoryErpPosting> postings)
        {
            if (!IsPostedLine(count, item) || !postings.TryGetValue(count.Id, out InventoryErpPosting? posting))
            {
                return (null, null, null);
            }

            return (posting.Status, posting.ErpReference, posting.Status == Common.SILA_POSTING_FAILED ? posting.ErrorMessage : null);
        }
    }
}

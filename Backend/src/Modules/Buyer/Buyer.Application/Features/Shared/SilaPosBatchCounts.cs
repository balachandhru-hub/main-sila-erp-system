using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Per sales batch: lines processed (inventory deducted, whatever the ERP outcome) and lines whose ERP posting outcome is
    /// unknown (to reconcile). Two grouped queries for any number of batches.
    /// </summary>
    public static class SilaPosBatchCounts
    {
        public static async Task AddAsync(IRepositoryWrapper repository, Guid buyerId, List<SilaPosBatchDto> batches, CancellationToken cancellationToken)
        {
            if (batches.Count == 0)
            {
                return;
            }

            List<Guid?> ids = batches.Select(x => (Guid?)x.Id).ToList();
            Dictionary<Guid, int> processed = await repository.PosSalesTransaction
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && ids.Contains(x.BatchId)
                    && (x.Status == Common.SILA_POS_INVENTORY_DEDUCTED || x.Status == Common.SILA_POS_POSTED
                        || (x.Status == Common.SILA_POS_FAILED && x.FailedStep == Common.SILA_POS_STEP_POST)))
                .GroupBy(x => x.BatchId!.Value)
                .Select(x => new { BatchId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.BatchId, x => x.Count, cancellationToken);
            IQueryable<Guid> unknownPostings = repository.InventoryErpPosting
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.ReferenceType == Common.SILA_REF_POS_SALE && x.Status == Common.SILA_POSTING_UNKNOWN)
                .Select(x => x.Id);
            Dictionary<Guid, int> unknown = await repository.PosSalesTransaction
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && ids.Contains(x.BatchId)
                    && x.Status == Common.SILA_POS_INVENTORY_DEDUCTED && x.ErpPostingId != null && unknownPostings.Contains(x.ErpPostingId.Value))
                .GroupBy(x => x.BatchId!.Value)
                .Select(x => new { BatchId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.BatchId, x => x.Count, cancellationToken);

            foreach (SilaPosBatchDto batch in batches)
            {
                batch.Processed = processed.GetValueOrDefault(batch.Id);
                batch.PostingUnknown = unknown.GetValueOrDefault(batch.Id);
            }
        }
    }
}

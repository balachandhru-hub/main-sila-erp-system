using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>Document numbers of the references of audit events, one query per reference type on the page.</summary>
    public static class SilaAuditReferences
    {
        public static async Task<Dictionary<Guid, string>> GetNumbersAsync(
            IRepositoryWrapper repository, Guid buyerId, List<InventoryWorkflowEvent> events, CancellationToken cancellationToken)
        {
            Dictionary<Guid, string> numbers = new Dictionary<Guid, string>();
            foreach (IGrouping<string, InventoryWorkflowEvent> group in events.GroupBy(x => x.ReferenceType))
            {
                List<Guid> ids = group.Select(x => x.ReferenceId).Distinct().ToList();
                Dictionary<Guid, string> found = await LoadAsync(repository, buyerId, group.Key, ids, cancellationToken);
                foreach (KeyValuePair<Guid, string> pair in found)
                {
                    numbers[pair.Key] = pair.Value;
                }
            }

            return numbers;
        }

        private static async Task<Dictionary<Guid, string>> LoadAsync(
            IRepositoryWrapper repository, Guid buyerId, string referenceType, List<Guid> ids, CancellationToken cancellationToken)
        {
            switch (referenceType)
            {
                case Common.SILA_REF_STOCK_COUNT:
                    return await repository.StockCount.FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                        .ToDictionaryAsync(x => x.Id, x => x.CountNumber, cancellationToken);
                case Common.SILA_REF_ENQUIRY:
                    return await repository.StockShortageEnquiry.FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                        .ToDictionaryAsync(x => x.Id, x => x.EnquiryNumber, cancellationToken);
                case Common.SILA_REF_PHYSICAL_INVENTORY:
                    return await repository.PhysicalInventoryRequest.FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                        .ToDictionaryAsync(x => x.Id, x => x.RequestNumber, cancellationToken);
                case Common.SILA_REF_ITO:
                    return await repository.InternalTransferOrder.FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                        .ToDictionaryAsync(x => x.Id, x => x.ItoNumber, cancellationToken);
                case Common.SILA_REF_ADJUSTMENT:
                    return await repository.StockAdjustment.FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                        .ToDictionaryAsync(x => x.Id, x => x.AdjustmentNumber, cancellationToken);
                case Common.SILA_REF_GOODS_ISSUE:
                    return await repository.GoodsIssue.FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                        .ToDictionaryAsync(x => x.Id, x => x.IssueNumber, cancellationToken);
                case Common.SILA_REF_RECIPE:
                    return await repository.Recipe.FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                        .ToDictionaryAsync(x => x.Id, x => x.RecipeCode, cancellationToken);
                case Common.SILA_REF_GRN:
                    return await repository.GoodsReceipt.FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                        .ToDictionaryAsync(x => x.Id, x => x.GrnNumber, cancellationToken);
                case Common.SILA_REF_MATERIAL_PRICE:
                    return await repository.MaterialPriceChange.FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                        .ToDictionaryAsync(x => x.Id, x => x.RequestNumber, cancellationToken);
                case Common.SILA_REF_PURCHASE_REQUEST:
                    return await repository.InternalPurchaseRequest.FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                        .ToDictionaryAsync(x => x.Id, x => x.RequestNumber, cancellationToken);
                case SilaAlertRules.REF_ALERT:
                    return await repository.InventoryAlert.FindByCondition(x => x.BuyerId == buyerId && ids.Contains(x.Id))
                        .ToDictionaryAsync(x => x.Id, x => x.Title, cancellationToken);
                default:
                    return new Dictionary<Guid, string>();
            }
        }
    }
}

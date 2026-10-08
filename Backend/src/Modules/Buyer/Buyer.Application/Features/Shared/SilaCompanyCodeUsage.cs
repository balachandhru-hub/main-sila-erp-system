using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Where a company code is used (ERP APIs routed by it, properties, purchase orders), so it is not renamed or deleted
    /// from under them.
    /// </summary>
    public static class SilaCompanyCodeUsage
    {
        /// <summary>A sentence naming the first use found, or null when the code is not used.</summary>
        public static async Task<string?> DescribeAsync(IRepositoryWrapper repository, BuyerBusinessProfile buyer, string code, CancellationToken cancellationToken)
        {
            bool api = await repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.EntityCode == code)
                .AnyAsync(cancellationToken);
            if (api)
            {
                return $"An ERP API under Integration is configured for company code {code}.";
            }

            bool property = await repository.BuyerProperty
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.CompanyCode == code)
                .AnyAsync(cancellationToken);
            if (property)
            {
                return $"A property uses company code {code}.";
            }

            bool purchaseOrder = await repository.PurchaseOrder
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.CompanyCode == code
                    && x.Status != SilaReceivingRules.PO_CANCELLED && x.Status != Common.SILA_PO_RECEIVED)
                .AnyAsync(cancellationToken);
            return purchaseOrder ? $"Open purchase orders use company code {code}." : null;
        }
    }
}

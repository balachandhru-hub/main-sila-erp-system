using Buyer.Application.Services;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// What is known before a purchase order is created from a contract: the ERP details every order of the buyer
    /// needs, the values that can be filled in, and the ones the user must type.
    /// </summary>
    public static class ContractPurchaseOrderDrafts
    {
        /// <summary>Details the ERP needs and nothing else holds. Required only when the buyer has a purchase order API.</summary>
        public static readonly string[] ErpRequiredFields =
        {
            nameof(CreateContractPurchaseOrderRequestDto.PurchasingOrganization),
            nameof(CreateContractPurchaseOrderRequestDto.PurchasingGroup),
            nameof(CreateContractPurchaseOrderRequestDto.CompanyCode),
            nameof(CreateContractPurchaseOrderRequestDto.SupplierCode),
            nameof(CreateContractPurchaseOrderRequestDto.Plant)
        };

        /// <summary>The contract supplier's vendor number in the buyer's supplier master, when the supplier is in it.</summary>
        public static async Task<string?> FindSupplierCodeAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            Guid supplierOrganizationId,
            CancellationToken cancellationToken)
        {
            return await repository.SilaSupplier
                .FindByCondition(x => x.BuyerId == buyerId && x.SupplierOrganizationId == supplierOrganizationId && x.IsActive)
                .Select(x => x.SupplierCode)
                .FirstOrDefaultAsync(cancellationToken);
        }

        /// <summary>The ERP details of the buyer's latest purchase order from a contract, so they need not be typed again.</summary>
        public static async Task<CreateContractPurchaseOrderRequestDto> LastUsedAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            CancellationToken cancellationToken)
        {
            string? json = await repository.PurchaseOrder
                .FindByCondition(x => x.BuyerId == buyerId && x.ContractId != null && x.ErpRequestOptions != null && x.IsActive)
                .OrderByDescending(x => x.OrderDate)
                .Select(x => x.ErpRequestOptions)
                .FirstOrDefaultAsync(cancellationToken);
            return ContractPurchaseOrderPayload.ReadOptions(json);
        }

        /// <summary>The names in <see cref="ErpRequiredFields"/> that have no value, in camelCase as the API sends them.</summary>
        public static List<string> MissingRequired(CreateContractPurchaseOrderRequestDto options)
        {
            Dictionary<string, string?> values = new Dictionary<string, string?>
            {
                [nameof(options.PurchasingOrganization)] = options.PurchasingOrganization,
                [nameof(options.PurchasingGroup)] = options.PurchasingGroup,
                [nameof(options.CompanyCode)] = options.CompanyCode,
                [nameof(options.SupplierCode)] = options.SupplierCode,
                [nameof(options.Plant)] = options.Plant
            };
            return values
                .Where(x => string.IsNullOrWhiteSpace(x.Value))
                .Select(x => char.ToLowerInvariant(x.Key[0]) + x.Key.Substring(1))
                .ToList();
        }

        public static List<string> RequiredFieldNames()
        {
            return ErpRequiredFields.Select(x => char.ToLowerInvariant(x[0]) + x.Substring(1)).ToList();
        }
    }
}

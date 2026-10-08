using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Rules and read models of the purchase orders created from a contract.
    /// </summary>
    public static class ContractPurchaseOrderRules
    {
        public static bool IsApproved(string? status)
        {
            return string.Equals(status, Common.COMPLETE, StringComparison.OrdinalIgnoreCase)
                || string.Equals(status, Common.CONTRACT_COMPLETED_STATUS, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// The reason a purchase order cannot be created from the contract now, or null when it can.
        /// </summary>
        public static string? BlockedReason(PredefinedContract contract, decimal orderedAmount, DateTime utcNow)
        {
            if (!IsApproved(contract.Status))
            {
                return "The contract is not fully approved.";
            }

            if (utcNow.Date < contract.StartDate.Date)
            {
                return $"The contract starts on {contract.StartDate:yyyy-MM-dd}.";
            }

            if (utcNow.Date > contract.EndDate.Date)
            {
                return $"The contract ended on {contract.EndDate:yyyy-MM-dd}.";
            }

            if (contract.Amount - orderedAmount <= 0)
            {
                return "The contract amount is fully used by purchase orders.";
            }

            return null;
        }

        public static string DeriveErpSyncStatus(string? erpPoId, PurchaseDocumentIntegration? integration)
        {
            if (!string.IsNullOrWhiteSpace(erpPoId))
            {
                return Common.PURCHASE_ORDER_ERP_SYNCED;
            }

            if (integration == null)
            {
                return Common.PURCHASE_ORDER_ERP_NOT_CONFIGURED;
            }

            return integration.Status switch
            {
                Common.INTEGRATION_FAILED => Common.PURCHASE_ORDER_ERP_FAILED,
                Common.INTEGRATION_UNKNOWN => Common.PURCHASE_ORDER_ERP_UNKNOWN,
                Common.INTEGRATION_SUCCEEDED => Common.PURCHASE_ORDER_ERP_SYNCED,
                _ => Common.PURCHASE_ORDER_ERP_PENDING
            };
        }

        public static ContractPurchaseOrderDto ToDto(
            PurchaseOrder purchaseOrder,
            string? contractNumber,
            PurchaseDocumentIntegration? integration,
            int itemCount)
        {
            string syncStatus = DeriveErpSyncStatus(purchaseOrder.ErpPurchaseOrderId, integration);
            return new ContractPurchaseOrderDto
            {
                Id = purchaseOrder.Id,
                PoNumber = purchaseOrder.PoNumber,
                ContractId = purchaseOrder.ContractId,
                ContractNumber = contractNumber,
                SupplierId = purchaseOrder.SupplierId,
                SupplierName = purchaseOrder.SupplierName,
                Status = purchaseOrder.Status,
                Currency = purchaseOrder.Currency,
                TotalAmount = purchaseOrder.TotalAmount,
                OrderDate = purchaseOrder.OrderDate,
                ItemCount = itemCount,
                ErpPurchaseOrderId = purchaseOrder.ErpPurchaseOrderId,
                ErpSyncStatus = syncStatus,
                ErpSyncError = syncStatus == Common.PURCHASE_ORDER_ERP_FAILED || syncStatus == Common.PURCHASE_ORDER_ERP_UNKNOWN
                    ? integration?.ErrorMessage
                    : null
            };
        }

        /// <summary>
        /// The purchase orders of each contract, newest first, with their ERP hand-off.
        /// </summary>
        public static async Task<Dictionary<Guid, List<ContractPurchaseOrderDto>>> ListByContractAsync(
            IRepositoryWrapper repository,
            IReadOnlyCollection<PredefinedContract> contracts,
            CancellationToken cancellationToken)
        {
            List<Guid> contractIds = contracts.Select(x => x.Id).ToList();
            Dictionary<Guid, string?> numbers = contracts.ToDictionary(x => x.Id, x => x.ContractNumber);

            List<PurchaseOrder> orders = await repository.PurchaseOrder
                .FindByCondition(x => x.ContractId != null && contractIds.Contains(x.ContractId.Value) && x.IsActive)
                .OrderByDescending(x => x.OrderDate)
                .ToListAsync(cancellationToken);
            List<Guid> orderIds = orders.Select(x => x.Id).ToList();

            Dictionary<Guid, int> itemCounts = await repository.PurchaseOrderItem
                .FindByCondition(x => orderIds.Contains(x.PurchaseOrderId) && x.IsActive)
                .GroupBy(x => x.PurchaseOrderId)
                .Select(x => new { x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.Key, x => x.Count, cancellationToken);

            Dictionary<Guid, PurchaseDocumentIntegration> integrations = (await repository.PurchaseDocumentIntegration
                .FindByCondition(x => x.PurchaseOrderId != null && orderIds.Contains(x.PurchaseOrderId.Value)
                    && x.IntegrationType == Common.ERP_OPERATION_PO_CREATE && x.IsActive)
                .ToListAsync(cancellationToken))
                .ToDictionary(x => x.PurchaseOrderId!.Value);

            Dictionary<Guid, List<ContractPurchaseOrderDto>> result = new Dictionary<Guid, List<ContractPurchaseOrderDto>>();
            foreach (PurchaseOrder order in orders)
            {
                integrations.TryGetValue(order.Id, out PurchaseDocumentIntegration? integration);
                itemCounts.TryGetValue(order.Id, out int itemCount);
                if (!result.TryGetValue(order.ContractId!.Value, out List<ContractPurchaseOrderDto>? list))
                {
                    list = new List<ContractPurchaseOrderDto>();
                    result[order.ContractId.Value] = list;
                }

                list.Add(ToDto(order, numbers.GetValueOrDefault(order.ContractId.Value), integration, itemCount));
            }

            return result;
        }

        /// <summary>How the hand-off of each executed contract to the ERP stands.</summary>
        public static async Task<Dictionary<Guid, ContractErpSyncDto>> ListContractErpSyncAsync(
            IRepositoryWrapper repository,
            IReadOnlyCollection<PredefinedContract> contracts,
            CancellationToken cancellationToken)
        {
            List<Guid> contractIds = contracts.Select(x => x.Id).ToList();
            Dictionary<Guid, PurchaseDocumentIntegration> integrations = (await repository.PurchaseDocumentIntegration
                .FindByCondition(x => x.ContractId != null && contractIds.Contains(x.ContractId.Value)
                    && x.IntegrationType == Common.ERP_OPERATION_CONTRACT_CREATE && x.IsActive)
                .ToListAsync(cancellationToken))
                .GroupBy(x => x.ContractId!.Value)
                .ToDictionary(x => x.Key, x => x.First());

            Dictionary<Guid, ContractErpSyncDto> result = new Dictionary<Guid, ContractErpSyncDto>();
            foreach (PredefinedContract contract in contracts)
            {
                integrations.TryGetValue(contract.Id, out PurchaseDocumentIntegration? integration);
                string status = DeriveErpSyncStatus(contract.ErpContractId, integration);
                result[contract.Id] = new ContractErpSyncDto
                {
                    ContractId = contract.Id,
                    ContractNumber = contract.ContractNumber,
                    ErpContractId = contract.ErpContractId,
                    ErpSyncStatus = status,
                    ErpSyncError = status == Common.PURCHASE_ORDER_ERP_FAILED || status == Common.PURCHASE_ORDER_ERP_UNKNOWN
                        ? integration?.ErrorMessage
                        : null
                };
            }

            return result;
        }

        public static async Task<Dictionary<Guid, ContractPurchaseOrderSummaryDto>> BuildSummariesAsync(
            IRepositoryWrapper repository,
            IReadOnlyCollection<PredefinedContract> contracts,
            CancellationToken cancellationToken)
        {
            Dictionary<Guid, List<ContractPurchaseOrderDto>> byContract = await ListByContractAsync(repository, contracts, cancellationToken);
            DateTime utcNow = DateTime.UtcNow;
            Dictionary<Guid, ContractPurchaseOrderSummaryDto> summaries = new Dictionary<Guid, ContractPurchaseOrderSummaryDto>();
            foreach (PredefinedContract contract in contracts)
            {
                byContract.TryGetValue(contract.Id, out List<ContractPurchaseOrderDto>? orders);
                orders ??= new List<ContractPurchaseOrderDto>();
                decimal ordered = orders.Sum(x => x.TotalAmount);
                string? blocked = BlockedReason(contract, ordered, utcNow);
                summaries[contract.Id] = new ContractPurchaseOrderSummaryDto
                {
                    PurchaseOrderCount = orders.Count,
                    PurchaseOrderTotal = ordered,
                    RemainingAmount = Math.Max(0, contract.Amount - ordered),
                    CanCreatePurchaseOrder = blocked == null,
                    CreateBlockedReason = blocked,
                    LatestPurchaseOrder = orders.FirstOrDefault()
                };
            }

            return summaries;
        }
    }
}

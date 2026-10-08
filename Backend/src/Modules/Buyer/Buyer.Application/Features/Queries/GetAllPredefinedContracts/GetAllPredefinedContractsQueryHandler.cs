using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Queries.GetAllPredefinedContracts
{
    public class GetAllPredefinedContractsQueryHandler
        : IRequestHandler<GetAllPredefinedContractsQuery, List<PredefinedContractResponseDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IIdentityApiClient _identityApiClient;
        private readonly ISupplierApiClient _supplierApiClient;

        public GetAllPredefinedContractsQueryHandler(
            IRepositoryWrapper repository,
            IIdentityApiClient identityApiClient,
            ISupplierApiClient supplierApiClient)
        {
            _repository = repository;
            _identityApiClient = identityApiClient;
            _supplierApiClient = supplierApiClient;
        }

        public async Task<List<PredefinedContractResponseDto>> Handle(
            GetAllPredefinedContractsQuery request,
            CancellationToken cancellationToken)
        {
            var contractsQuery = _repository.PredefinedContract
                .FindByCondition(x => x.IsActive && x.BuyerId == request.BuyerId);

            if (request.RoleId != Common.BUYER_ADMIN_ROLE_ID)
            {
                // A regular buyer user sees the contracts they created and the
                // contracts where they are an approver in the approval flow;
                // only the Buyer Admin sees every contract for the buyer.
                var approverFlowIds = _repository.PredefinedContractApprovalUserMapping
                    .FindByCondition(m => m.UserId == request.UserId && m.IsActive)
                    .Select(m => m.ContractApprovalFlowId);

                var approverContractIds = _repository.PredefinedContractApprovalFlow
                    .FindByCondition(f => f.IsActive && approverFlowIds.Contains(f.Id))
                    .Select(f => f.ContractId);

                contractsQuery = contractsQuery.Where(x =>
                    x.CreatedBy == request.UserId ||
                    approverContractIds.Contains(x.Id));
            }

            var contracts = await contractsQuery
                .Include(x => x.RFQ)
                .OrderByDescending(x => x.DateCreated)
                .Skip(request.Index)
                .Take(request.Limit)
                .Select(contract => new PredefinedContractResponseDto
                {
                    Id = contract.Id,
                    ContractNumber = contract.ContractNumber,
                    ContractName = contract.ContractName,
                    RFQId = contract.RFQId,
                    RFQNumber = contract.RFQ != null ? contract.RFQ.RFQNumber : null,
                    RFQTitle = contract.RFQ != null ? contract.RFQ.Title : null,
                    StartDate = contract.StartDate,
                    EndDate = contract.EndDate,
                    Amount = contract.Amount,
                    DateCreated = contract.DateCreated,
                    Status = contract.Status,
                    SupplierId = contract.SupplierId,
                    ErpContractId = contract.ErpContractId
                })
                .ToListAsync(cancellationToken);

            var contractIds = contracts.Select(x => x.Id).ToList();

            var attachments = await _repository.PredefinedContractAttachment
                .FindByCondition(x =>
                    contractIds.Contains(x.ContractId) &&
                    x.IsActive)
                .ToListAsync(cancellationToken);

            var assetIds = attachments.Select(x => x.AssetId).ToList();

            var assetFileNamesById = await _repository.Asset
                .FindByCondition(x => assetIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.FileName, cancellationToken);

            var attachmentsByContractId = attachments
                .GroupBy(x => x.ContractId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(x => new PredefinedContractAttachmentDto
                    {
                        Id = x.Id,
                        AssetId = x.AssetId,
                        Type = x.Type,
                        FileName = assetFileNamesById.TryGetValue(x.AssetId, out var fileName)
                            ? fileName
                            : null,
                        Title = x.Title,
                        UnspscId = x.UnspscId,
                        SegmentId = x.SegmentId,
                        SegmentTitle = x.SegmentTitle
                    }).ToList());

            var approvalFlows = await _repository.PredefinedContractApprovalFlow
                .FindByCondition(x =>
                    contractIds.Contains(x.ContractId) &&
                    x.IsActive)
                .ToListAsync(cancellationToken);

            var approvalFlowsByContractId = approvalFlows
                .GroupBy(x => x.ContractId)
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(x => new PredefinedContractApprovalFlowDto
                    {
                        Id = x.Id,
                        ApprovalCode = x.ApprovalCode,
                        ApprovalName = x.ApprovalName,
                        ContractId = x.ContractId,
                        Type = x.Type,
                        TotalAmount = x.TotalAmount,
                        Currency = x.Currency
                    }).ToList());

            var approvalFlowIds = approvalFlows.Select(x => x.Id).ToList();
            var approvalFlowIdToContractId = approvalFlows
                .ToDictionary(x => x.Id, x => x.ContractId);

            var approvalUserMappings = await _repository.PredefinedContractApprovalUserMapping
                .FindByCondition(x =>
                    approvalFlowIds.Contains(x.ContractApprovalFlowId) &&
                    x.IsActive)
                .OrderBy(x => x.Order)
                .ToListAsync(cancellationToken);

            var approvalUsersByContractId = approvalUserMappings
                .GroupBy(x => approvalFlowIdToContractId[x.ContractApprovalFlowId])
                .ToDictionary(
                    g => g.Key,
                    g => g.Select(x => new PredefinedContractApprovalUserDto
                    {
                        UserId = x.UserId,
                        Order = x.Order,
                        Status = x.Status
                    }).ToList());

            var approvalUserIds = approvalUserMappings
                .Select(x => x.UserId)
                .Distinct()
                .ToList();

            if (approvalUserIds.Any())
            {
                var identityUsers = await _identityApiClient.GetUsersByIds(
                    approvalUserIds,
                    cancellationToken);

                foreach (var approvalUser in approvalUsersByContractId.Values.SelectMany(x => x))
                {
                    var identity = identityUsers
                        .FirstOrDefault(x => x.UserId == approvalUser.UserId);

                    approvalUser.UserName = identity?.UserName;
                    approvalUser.Email = identity?.Email;
                }
            }

            // Purchase order figures and supplier names, for the contract list.
            var contractEntities = contracts
                .Select(x => new PredefinedContract
                {
                    Id = x.Id,
                    ContractNumber = x.ContractNumber,
                    StartDate = x.StartDate,
                    EndDate = x.EndDate,
                    Amount = x.Amount,
                    Status = x.Status,
                    ErpContractId = x.ErpContractId
                })
                .ToList();
            var erpSyncByContract = await ContractPurchaseOrderRules.ListContractErpSyncAsync(
                _repository,
                contractEntities,
                cancellationToken);
            var purchaseOrderSummaries = await ContractPurchaseOrderRules.BuildSummariesAsync(
                _repository,
                contractEntities,
                cancellationToken);
            var supplierNamesById = await GetSupplierNamesAsync(
                contracts.Select(x => x.SupplierId).Distinct().ToList(),
                cancellationToken);

            foreach (var contract in contracts)
            {
                contract.PurchaseOrderSummary = purchaseOrderSummaries[contract.Id];
                contract.ErpSyncStatus = erpSyncByContract[contract.Id].ErpSyncStatus;
                contract.ErpSyncError = erpSyncByContract[contract.Id].ErpSyncError;
                contract.SupplierName = supplierNamesById.GetValueOrDefault(contract.SupplierId);

                contract.Attachments = attachmentsByContractId.TryGetValue(contract.Id, out var atts)
                    ? atts
                    : new List<PredefinedContractAttachmentDto>();

                contract.ApprovalFlows = approvalFlowsByContractId.TryGetValue(contract.Id, out var flows)
                    ? flows
                    : new List<PredefinedContractApprovalFlowDto>();

                contract.ApprovalUsers = approvalUsersByContractId.TryGetValue(contract.Id, out var approvers)
                    ? approvers
                    : new List<PredefinedContractApprovalUserDto>();
            }

            return contracts;
        }

        private async Task<Dictionary<Guid, string>> GetSupplierNamesAsync(
            List<Guid> supplierIds,
            CancellationToken cancellationToken)
        {
            if (supplierIds.Count == 0)
            {
                return new Dictionary<Guid, string>();
            }

            try
            {
                var names = await _supplierApiClient.GetSupplierNamesByIds(supplierIds, cancellationToken);
                return names
                    .GroupBy(x => x.SupplierId)
                    .ToDictionary(g => g.Key, g => g.First().SupplierName);
            }
            catch (Exception)
            {
                // The name is only for display: the list does not wait on it.
                return new Dictionary<Guid, string>();
            }
        }
    }
}

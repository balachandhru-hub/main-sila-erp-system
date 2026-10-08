using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Application.Services;
using Buyer.Domain.Common;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetPredefinedContract
{
    public class GetPredefinedContractQueryHandler
        : IRequestHandler<GetPredefinedContractQuery, PredefinedContractResponseDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IIdentityApiClient _identityApiClient;
        private readonly ISupplierApiClient _supplierApiClient;
        private readonly ILoggerManager _logger;

        public GetPredefinedContractQueryHandler(
            IRepositoryWrapper repository,
            IIdentityApiClient identityApiClient,
            ISupplierApiClient supplierApiClient,
            ILoggerManager logger)
        {
            _repository = repository;
            _identityApiClient = identityApiClient;
            _supplierApiClient = supplierApiClient;
            _logger = logger;
        }

        public async Task<PredefinedContractResponseDto> Handle(
            GetPredefinedContractQuery request,
            CancellationToken cancellationToken)
        {
            var contract = await _repository.PredefinedContract
                .FindByCondition(x =>
                    x.Id == request.ContractId &&
                    x.IsActive)
                .Include(x => x.RFQ)
                .FirstOrDefaultAsync(cancellationToken);

            if (contract == null)
            {
                _logger.LogError($"Contract not found. ContractId: {request.ContractId}");
                throw new NotFoundCustomException(
                    "Contract not found.",
                    $"No contract was found with ContractId: {request.ContractId}");
            }

            var attachments = await _repository.PredefinedContractAttachment
                .FindByCondition(x =>
                    x.ContractId == contract.Id &&
                    x.IsActive)
                .ToListAsync(cancellationToken);

            var assetIds = attachments.Select(x => x.AssetId).ToList();

            var assetFileNamesById = await _repository.Asset
                .FindByCondition(x => assetIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.FileName, cancellationToken);

            var approvalFlows = await _repository.PredefinedContractApprovalFlow
                .FindByCondition(x =>
                    x.ContractId == contract.Id &&
                    x.IsActive)
                .ToListAsync(cancellationToken);

            var approvalFlowIds = approvalFlows.Select(x => x.Id).ToList();

            var approvalUsers = await _repository.PredefinedContractApprovalUserMapping
                .FindByCondition(x =>
                    approvalFlowIds.Contains(x.ContractApprovalFlowId) &&
                    x.IsActive)
                .OrderBy(x => x.Order)
                .Select(x => new PredefinedContractApprovalUserDto
                {
                    UserId = x.UserId,
                    Order = x.Order,
                    Status = x.Status
                })
                .ToListAsync(cancellationToken);

            if (approvalUsers.Any())
            {
                var approvalUserIds = approvalUsers
                    .Select(x => x.UserId)
                    .Distinct()
                    .ToList();

                var identityUsers = await _identityApiClient.GetUsersByIds(
                    approvalUserIds,
                    cancellationToken);

                foreach (var approvalUser in approvalUsers)
                {
                    var identity = identityUsers
                        .FirstOrDefault(x => x.UserId == approvalUser.UserId);

                    approvalUser.UserName = identity?.UserName;
                    approvalUser.Email = identity?.Email;
                }
            }

            var purchaseOrderSummaries = await ContractPurchaseOrderRules.BuildSummariesAsync(
                _repository,
                new List<PredefinedContract> { contract },
                cancellationToken);

            var erpSync = (await ContractPurchaseOrderRules.ListContractErpSyncAsync(
                _repository,
                new List<PredefinedContract> { contract },
                cancellationToken))[contract.Id];

            // What was awarded to the supplier, priced from the supplier's quotation.
            var items = await new ContractAwardLineBuilder(_repository, _supplierApiClient, _logger)
                .BuildForDisplayAsync(contract, cancellationToken);

            // The fully-signed contract is attached when the contract is executed (contract details), not on the contract itself.
            var executedIds = await _repository.ContractDetails
                .FindByCondition(x => x.PredefinedContractId == contract.Id && x.IsActive)
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            var signedAttachments = await _repository.ContractAttachment
                .FindByCondition(x => executedIds.Contains(x.ContractDetailsId) && x.IsActive)
                .ToListAsync(cancellationToken);
            var signedAssetIds = signedAttachments.Select(x => x.AssetId).ToList();
            var signedFileNames = await _repository.Asset
                .FindByCondition(x => signedAssetIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.FileName, cancellationToken);
            var signedDocuments = signedAttachments
                .Select(x => new PredefinedContractAttachmentDto
                {
                    Id = x.Id,
                    AssetId = x.AssetId,
                    Type = Common.CONTRACT_ASSET_SIGNED_CONTRACT,
                    FileName = signedFileNames.TryGetValue(x.AssetId, out var signedName) ? signedName : null,
                    Title = signedFileNames.TryGetValue(x.AssetId, out var signedTitle) ? signedTitle ?? string.Empty : string.Empty
                })
                .ToList();

            string? supplierName = null;
            try
            {
                var supplierNames = await _supplierApiClient.GetSupplierNamesByIds(
                    new List<Guid> { contract.SupplierId },
                    cancellationToken);
                supplierName = supplierNames.FirstOrDefault(x => x.SupplierId == contract.SupplierId)?.SupplierName;
            }
            catch (Exception)
            {
                // The name is only for display: the contract does not wait on it.
            }

            return new PredefinedContractResponseDto
            {
                Id = contract.Id,
                ContractNumber = contract.ContractNumber,
                ContractName = contract.ContractName,
                RFQId = contract.RFQId,
                RFQNumber = contract.RFQ?.RFQNumber,
                RFQTitle = contract.RFQ?.Title,
                StartDate = contract.StartDate,
                EndDate = contract.EndDate,
                Amount = contract.Amount,
                DateCreated = contract.DateCreated,
                Status = contract.Status,
                SupplierId = contract.SupplierId,
                SupplierName = supplierName,
                ErpContractId = contract.ErpContractId,
                ErpSyncStatus = erpSync.ErpSyncStatus,
                ErpSyncError = erpSync.ErpSyncError,
                Items = items,
                PurchaseOrderSummary = purchaseOrderSummaries[contract.Id],
                Attachments = attachments
                    .Select(x => new PredefinedContractAttachmentDto
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
                    })
                    .Concat(signedDocuments)
                    .ToList(),
                ApprovalFlows = approvalFlows
                    .Select(x => new PredefinedContractApprovalFlowDto
                    {
                        Id = x.Id,
                        ApprovalCode = x.ApprovalCode,
                        ApprovalName = x.ApprovalName,
                        ContractId = x.ContractId,
                        Type = x.Type,
                        TotalAmount = x.TotalAmount,
                        Currency = x.Currency
                    })
                    .ToList(),
                ApprovalUsers = approvalUsers
            };
        }
    }
}

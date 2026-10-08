using System.Text.Json;
using Buyer.Application.Features.Commands.SendIntegrationRequest;
using Buyer.Application.Features.Queries.ResolveIntegration;
using Buyer.Application.Features.Shared;
using Buyer.Application.Services.Integration;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.Contracts.IServices;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services
{
    /// <summary>
    /// Sends an executed contract to the buyer's active contract API (POST_CONTRACT) and keeps the id the ERP returns
    /// as the contract's ErpContractId. The buyer decides whether the call happens at all: with no active contract
    /// API nothing is sent and the contract is untouched. A contract the ERP already accepted is never sent again,
    /// and two requests at the same moment cannot both send it. A failure is kept on the hand-off row with its
    /// error, and the same call can be made again to retry.
    /// </summary>
    public class ContractErpIntegrationProcessor
    {
        // A PROCESSING hand-off older than this is taken to be a request that died, and may be claimed again.
        private static readonly TimeSpan StaleAfter = TimeSpan.FromMinutes(5);

        private readonly IRepositoryWrapper _repository;
        private readonly IMediator _mediator;
        private readonly IUserContext _userContext;
        private readonly ILoggerManager _logger;

        public ContractErpIntegrationProcessor(
            IRepositoryWrapper repository,
            IMediator mediator,
            IUserContext userContext,
            ILoggerManager logger)
        {
            _repository = repository;
            _mediator = mediator;
            _userContext = userContext;
            _logger = logger;
        }

        /// <summary>
        /// The hand-off right after a contract was created. It never throws: the contract exists, and a failure is
        /// kept on the hand-off row (or logged) for a retry.
        /// </summary>
        public async Task TrySendAfterCreateAsync(Guid contractId, Guid buyerId, CancellationToken cancellationToken)
        {
            try
            {
                BuyerBusinessProfile? buyer = _repository.BuyerBusinessProfile.FindFirstByCondition(x => x.Id == buyerId && x.IsActive);
                if (buyer == null)
                {
                    return;
                }

                await SendAsync(contractId, buyerId, buyer.OrganizationId, Guid.Empty, cancellationToken);
            }
            catch (Exception exception)
            {
                _logger.LogError($"The contract could not be sent to the ERP after it was created. ContractId: {contractId}, Error: {exception.Message}");
            }
        }

        /// <summary>True while an approver of the contract has not approved it yet. A contract without an approval chain has nothing to wait for.</summary>
        public async Task<bool> ApprovalPendingAsync(Guid contractId, CancellationToken cancellationToken)
        {
            List<Guid> flowIds = await _repository.PredefinedContractApprovalFlow
                .FindByCondition(flow => flow.ContractId == contractId && flow.IsActive)
                .Select(flow => flow.Id)
                .ToListAsync(cancellationToken);
            return flowIds.Count > 0 && await _repository.PredefinedContractApprovalUserMapping
                .FindByCondition(user => flowIds.Contains(user.ContractApprovalFlowId) && user.IsActive && user.Status != Common.APPROVED)
                .AnyAsync(cancellationToken);
        }

        /// <summary>
        /// Reprocessing for contracts created before the contract API existed: sends every approved contract of the
        /// buyer that the ERP does not have yet. Called when a contract API is activated. It never throws: one
        /// failing contract is kept on its hand-off row and does not stop the others.
        /// </summary>
        public async Task ReprocessPendingAsync(Guid buyerId, Guid buyerOrganizationId, Guid actorUserId, CancellationToken cancellationToken)
        {
            List<Guid> contractIds;
            try
            {
                contractIds = await _repository.PredefinedContract
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive
                        && (x.ErpContractId == null || x.ErpContractId == "")
                        && x.Status != Common.CONTRACT_DRAFT_STATUS
                        && x.Status != Common.CONTRACT_REJECTED_STATUS)
                    .OrderBy(x => x.DateCreated)
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken);
            }
            catch (Exception exception)
            {
                _logger.LogError($"The contracts to reprocess could not be read. BuyerId: {buyerId}, Error: {exception.Message}");
                return;
            }

            _logger.LogInfo($"Reprocessing contracts for the ERP. BuyerId: {buyerId}, Count: {contractIds.Count}");
            foreach (Guid contractId in contractIds)
            {
                try
                {
                    if (await ApprovalPendingAsync(contractId, cancellationToken))
                    {
                        continue;
                    }

                    await SendAsync(contractId, buyerId, buyerOrganizationId, actorUserId, cancellationToken);
                }
                catch (Exception exception)
                {
                    _logger.LogError($"A contract could not be reprocessed for the ERP. ContractId: {contractId}, Error: {exception.Message}");
                }
            }
        }

        public async Task<ContractErpSyncDto> SendAsync(
            Guid contractId,
            Guid buyerId,
            Guid buyerOrganizationId,
            Guid actorUserId,
            CancellationToken cancellationToken)
        {
            if (actorUserId != Guid.Empty)
            {
                _userContext.SetCurrentUserId(actorUserId);
            }

            PredefinedContract contract = _repository.PredefinedContract.FindFirstByCondition(
                x => x.Id == contractId && x.BuyerId == buyerId && x.IsActive);
            if (contract == null)
            {
                _logger.LogError($"Contract not found while sending it to the ERP. ContractId: {contractId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Contract not found.", "No contract exists for this buyer organization.");
            }

            if (!string.IsNullOrWhiteSpace(contract.ErpContractId))
            {
                _logger.LogInfo($"Contract already exists in the ERP. ContractId: {contract.Id}, ErpContractId: {contract.ErpContractId}");
                return ToDto(contract, null);
            }

            IntegrationApiDto api = await _mediator.Send(new ResolveIntegrationQuery
            {
                OrganizationId = buyerOrganizationId,
                ProcessType = IntegrationProcessType.POST_CONTRACT,
                EntityCode = null
            }, cancellationToken);
            if (!api.Configured || api.ConfigurationId == null)
            {
                // The buyer has no contract API: nothing to send, and the contract stays as it is.
                _logger.LogInfo($"No contract API is active. ContractId: {contract.Id}, BuyerOrganizationId: {buyerOrganizationId}");
                return ToDto(contract, null);
            }

            PurchaseDocumentIntegration? integration = await ClaimAsync(contract, buyerOrganizationId, api, cancellationToken);
            if (integration == null)
            {
                // Another request is sending the same contract right now.
                _logger.LogInfo($"Contract is already being sent to the ERP. ContractId: {contract.Id}");
                return new ContractErpSyncDto
                {
                    ContractId = contract.Id,
                    ContractNumber = contract.ContractNumber,
                    ErpSyncStatus = Common.PURCHASE_ORDER_ERP_PENDING
                };
            }

            string correlationId = Guid.NewGuid().ToString("N");
            integration.CorrelationId = correlationId;
            integration.ConfigurationId = api.ConfigurationId;
            integration.ResolvedBaseUrl = api.BaseUrl ?? string.Empty;
            integration.ResolvedPath = api.ResourcePath ?? string.Empty;
            integration.ResolvedHttpMethod = api.HttpMethod ?? "POST";
            integration.ResolvedErpType = api.SystemName ?? string.Empty;
            await _repository.SaveAsync();

            IntegrationSendResultDto sent = await SendRequestAsync(contract, buyerOrganizationId, api, integration, correlationId, cancellationToken);

            bool httpSuccess = sent.Answered && sent.StatusCode >= 200 && sent.StatusCode < 300;
            string? erpContractId = httpSuccess ? ExternalDocumentNumberReader.TryReadContractReference(sent.ResponseBody) : null;
            integration.ResponseBody = sent.ResponseBody;
            integration.LastAttemptOn = DateTime.UtcNow;
            integration.NextAttemptOn = null;

            if (httpSuccess && !string.IsNullOrWhiteSpace(erpContractId))
            {
                integration.Status = Common.INTEGRATION_SUCCEEDED;
                integration.ExternalDocumentNumber = erpContractId;
                integration.ErrorMessage = null;
                integration.OutcomeUnknown = false;
                contract.ErpContractId = erpContractId;
                _logger.LogInfo(
                    $"Contract stored in the ERP. ContractId={contract.Id} System={api.SystemName} ConfigurationId={api.ConfigurationId} " +
                    $"CorrelationId={correlationId} DurationMs={sent.DurationMs}");
            }
            else
            {
                // A success without an id, like a call that broke off, may have created the contract in the ERP.
                bool unknown = sent.OutcomeUnknown || (httpSuccess && string.IsNullOrWhiteSpace(erpContractId));
                integration.Status = unknown ? Common.INTEGRATION_UNKNOWN : Common.INTEGRATION_FAILED;
                integration.RetryCount += 1;
                integration.OutcomeUnknown = unknown;
                integration.ErrorMessage = httpSuccess
                    ? "The contract API responded successfully but did not include an id."
                    : !sent.Answered && sent.OutcomeUnknown
                        ? "The contract API call did not complete. The contract may already exist there, so check the ERP before retrying."
                        : sent.Answered
                            ? $"The contract API returned HTTP {sent.StatusCode}."
                            : sent.ErrorMessage ?? "The contract API call failed.";
                _logger.LogError(
                    $"Contract ERP call failed. ContractId={contract.Id} System={api.SystemName} ConfigurationId={api.ConfigurationId} " +
                    $"CorrelationId={correlationId} StatusCode={sent.StatusCode} Code={sent.ErrorCode}");
            }

            await _repository.SaveAsync();
            return ToDto(contract, integration);
        }

        // The hand-off row, claimed for this request. Null when another request has it in progress.
        private async Task<PurchaseDocumentIntegration?> ClaimAsync(
            PredefinedContract contract,
            Guid buyerOrganizationId,
            IntegrationApiDto api,
            CancellationToken cancellationToken)
        {
            PurchaseDocumentIntegration? integration = _repository.PurchaseDocumentIntegration.FindFirstByCondition(
                x => x.ContractId == contract.Id && x.IntegrationType == Common.ERP_OPERATION_CONTRACT_CREATE && x.IsActive);
            if (integration != null)
            {
                bool claimed = await _repository.PurchaseDocumentIntegration.TryClaimAsync(integration.Id, DateTime.UtcNow - StaleAfter, cancellationToken);
                if (!claimed)
                {
                    return null;
                }

                integration.Status = Common.INTEGRATION_PROCESSING;
                return integration;
            }

            integration = new PurchaseDocumentIntegration
            {
                Id = Guid.NewGuid(),
                ContractId = contract.Id,
                BuyerOrganizationId = buyerOrganizationId,
                SupplierOrganizationId = contract.SupplierId,
                IntegrationType = Common.ERP_OPERATION_CONTRACT_CREATE,
                IdempotencyKey = $"contract:{contract.Id}",
                DocumentType = Common.ERP_DOCUMENT_CONTRACT,
                ConfigurationId = api.ConfigurationId,
                ConfigurationVersion = 1,
                Status = Common.INTEGRATION_PROCESSING,
                LastAttemptOn = DateTime.UtcNow,
                IsActive = true
            };
            _repository.PurchaseDocumentIntegration.Create(integration);
            try
            {
                await _repository.SaveAsync();
            }
            catch (DbUpdateException)
            {
                // The unique index on (contract, type): a parallel request inserted the row first.
                _repository.PurchaseDocumentIntegration.Delete(integration);
                return null;
            }

            return integration;
        }

        private async Task<IntegrationSendResultDto> SendRequestAsync(
            PredefinedContract contract,
            Guid buyerOrganizationId,
            IntegrationApiDto api,
            PurchaseDocumentIntegration integration,
            string correlationId,
            CancellationToken cancellationToken)
        {
            string rfqNumber = (await _repository.RFQ
                .FindByCondition(x => x.Id == contract.RFQId)
                .Select(x => x.RFQNumber)
                .FirstOrDefaultAsync(cancellationToken)) ?? string.Empty;
            string currency = (await _repository.RFQ
                .FindByCondition(x => x.Id == contract.RFQId)
                .Select(x => x.Currency)
                .FirstOrDefaultAsync(cancellationToken)) ?? string.Empty;

            Dictionary<string, string> headers = new Dictionary<string, string>
            {
                [Common.IDEMPOTENCY_HEADER] = integration.IdempotencyKey,
                ["X-Correlation-Id"] = correlationId
            };

            try
            {
                return await _mediator.Send(new SendIntegrationRequestCommand
                {
                    OrganizationId = buyerOrganizationId,
                    ConfigurationId = api.ConfigurationId!.Value,
                    Body = BuildPayload(api, contract, rfqNumber, currency, buyerOrganizationId, integration.IdempotencyKey),
                    Headers = headers
                }, cancellationToken);
            }
            catch (BaseCustomException exception)
            {
                // The API was refused before any call (not found or not active), so nothing was sent.
                _logger.LogError($"Contract was not sent. ConfigurationId: {api.ConfigurationId}, HttpStatus: {exception.Code}");
                return new IntegrationSendResultDto
                {
                    Answered = false,
                    StatusCode = exception.Code,
                    ErrorCode = "INTEGRATION_REFUSED",
                    ErrorMessage = "The contract API is not active. Activate it under Integrations."
                };
            }
        }

        private static string BuildPayload(
            IntegrationApiDto api,
            PredefinedContract contract,
            string rfqNumber,
            string currency,
            Guid buyerOrganizationId,
            string idempotencyKey)
        {
            if (!string.IsNullOrWhiteSpace(api.RequestBody))
            {
                return api.RequestBody
                    .Replace("{{contractId}}", contract.Id.ToString())
                    .Replace("{{contractNumber}}", contract.ContractNumber ?? string.Empty)
                    .Replace("{{contractName}}", contract.ContractName ?? string.Empty)
                    .Replace("{{rfqNumber}}", rfqNumber)
                    .Replace("{{supplierId}}", contract.SupplierId.ToString())
                    .Replace("{{buyerOrganizationId}}", buyerOrganizationId.ToString())
                    .Replace("{{startDate}}", contract.StartDate.ToString("yyyy-MM-dd"))
                    .Replace("{{endDate}}", contract.EndDate.ToString("yyyy-MM-dd"))
                    .Replace("{{amount}}", contract.Amount.ToString(System.Globalization.CultureInfo.InvariantCulture))
                    .Replace("{{currency}}", currency);
            }

            return JsonSerializer.Serialize(new
            {
                documentType = Common.ERP_DOCUMENT_CONTRACT,
                externalReference = contract.Id,
                idempotencyKey,
                contractId = contract.Id,
                contractNumber = contract.ContractNumber,
                contractName = contract.ContractName,
                rfqId = contract.RFQId,
                rfqNumber,
                buyerOrganizationId,
                supplierId = contract.SupplierId,
                startDate = contract.StartDate,
                endDate = contract.EndDate,
                amount = contract.Amount,
                currency
            });
        }

        private static ContractErpSyncDto ToDto(PredefinedContract contract, PurchaseDocumentIntegration? integration)
        {
            string status = ContractPurchaseOrderRules.DeriveErpSyncStatus(contract.ErpContractId, integration);
            return new ContractErpSyncDto
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
    }
}

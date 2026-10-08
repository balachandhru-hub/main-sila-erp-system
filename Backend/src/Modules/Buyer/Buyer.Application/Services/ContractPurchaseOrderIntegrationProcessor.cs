using Buyer.Application.Services.Integration;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.Contracts.IServices;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services
{
    /// <summary>
    /// Sends a purchase order created from a contract to the buyer's active purchase order API (POST_PO) and stores
    /// the document number the ERP returns as the order's ErpPurchaseOrderId. Called after the order was saved, from the create
    /// request and from the retry request. The order is never rolled back when the ERP does not accept it: the
    /// outcome is kept on the integration row, with the error, so it can be retried.
    /// </summary>
    public class ContractPurchaseOrderIntegrationProcessor
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IBuyerPurchaseDocumentGateway _buyerGateway;
        private readonly IUserContext _userContext;
        private readonly ILoggerManager _logger;

        public ContractPurchaseOrderIntegrationProcessor(
            IRepositoryWrapper repository,
            IBuyerPurchaseDocumentGateway buyerGateway,
            IUserContext userContext,
            ILoggerManager logger)
        {
            _repository = repository;
            _buyerGateway = buyerGateway;
            _userContext = userContext;
            _logger = logger;
        }

        /// <summary>
        /// Returns the integration row of the order, or null when the buyer has no purchase order API (nothing is sent).
        /// An order that already has an ErpPurchaseOrderId is never sent again.
        /// </summary>
        public async Task<PurchaseDocumentIntegration?> SendAsync(
            Guid purchaseOrderId,
            string? contractNumber,
            Guid actorUserId,
            CancellationToken cancellationToken)
        {
            _userContext.SetCurrentUserId(actorUserId);
            PurchaseOrder? order = _repository.PurchaseOrder.FindFirstByCondition(x => x.Id == purchaseOrderId && x.IsActive);
            if (order == null)
            {
                _logger.LogError($"Purchase order not found while sending it to the ERP. PurchaseOrderId: {purchaseOrderId}");
                return null;
            }

            PurchaseDocumentIntegration? integration = _repository.PurchaseDocumentIntegration.FindFirstByCondition(
                x => x.PurchaseOrderId == order.Id && x.IntegrationType == Common.ERP_OPERATION_PO_CREATE && x.IsActive);
            if (integration != null && integration.Status == Common.INTEGRATION_SUCCEEDED && !string.IsNullOrWhiteSpace(order.ErpPurchaseOrderId))
            {
                _logger.LogInfo($"Purchase order already exists in the ERP. PurchaseOrderId: {order.Id}, ErpPurchaseOrderId: {order.ErpPurchaseOrderId}");
                return integration;
            }

            IntegrationApiDto? configuration;
            try
            {
                configuration = await _buyerGateway.FindPurchaseOrderApiAsync(order.BuyerOrganizationId, order.CompanyCode, cancellationToken);
            }
            catch (Exception exception)
            {
                _logger.LogError($"The purchase order API could not be resolved. PurchaseOrderId: {order.Id}, Error: {exception.Message}");
                configuration = null;
            }

            if (configuration == null)
            {
                // No API: the order stays valid without an ErpPurchaseOrderId. An earlier failed attempt is kept as it was.
                _logger.LogInfo($"No purchase order API is active. PurchaseOrderId: {order.Id}, BuyerOrganizationId: {order.BuyerOrganizationId}");
                return integration;
            }

            if (integration == null)
            {
                integration = new PurchaseDocumentIntegration
                {
                    Id = Guid.NewGuid(),
                    PurchaseOrderId = order.Id,
                    ContractId = order.ContractId,
                    BuyerOrganizationId = order.BuyerOrganizationId,
                    SupplierOrganizationId = order.SupplierId,
                    IntegrationType = Common.ERP_OPERATION_PO_CREATE,
                    IdempotencyKey = $"contract-po:{order.Id}",
                    DocumentType = Common.ERP_DOCUMENT_PO,
                    Status = Common.INTEGRATION_PENDING,
                    IsActive = true
                };
                _repository.PurchaseDocumentIntegration.Create(integration);
            }

            string correlationId = Guid.NewGuid().ToString("N");
            integration.ConfigurationId = configuration.ConfigurationId;
            integration.ConfigurationVersion = 1;
            integration.ResolvedBaseUrl = configuration.BaseUrl ?? string.Empty;
            integration.ResolvedPath = configuration.ResourcePath ?? string.Empty;
            integration.ResolvedHttpMethod = configuration.HttpMethod ?? "POST";
            integration.ResolvedErpType = configuration.SystemName ?? string.Empty;
            integration.Status = Common.INTEGRATION_PROCESSING;
            integration.CorrelationId = correlationId;
            integration.LastAttemptOn = DateTime.UtcNow;
            await _repository.SaveAsync();

            List<PurchaseOrderItem> items = _repository.PurchaseOrderItem
                .FindByCondition(x => x.PurchaseOrderId == order.Id && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToList();

            // The body is the SAP S/4 purchase order, built from the order, its items and the ERP details saved with the order.
            CreateContractPurchaseOrderRequestDto options = ContractPurchaseOrderPayload.ReadOptions(order.ErpRequestOptions);
            string payload = ContractPurchaseOrderPayload.Build(order, items, options, configuration.RequestBody, contractNumber);

            BuyerPurchaseDocumentRequest request = new BuyerPurchaseDocumentRequest
            {
                PayloadOverride = payload,
                IdempotencyKey = integration.IdempotencyKey,
                PurchaseOrderId = order.Id,
                ContractId = order.ContractId,
                ContractNumber = contractNumber,
                BuyerOrganizationId = order.BuyerOrganizationId,
                CompanyCode = order.CompanyCode ?? string.Empty,
                PlantCode = order.PlantCode ?? string.Empty,
                SupplierId = order.SupplierId,
                SupplierName = order.SupplierName,
                DocumentType = Common.ERP_DOCUMENT_PO,
                BuyerDocumentNumber = order.PoNumber,
                Currency = order.Currency,
                RequiredDate = order.DeliveryDate,
                CorrelationId = correlationId,
                Lines = items.Select(line => new BuyerPurchaseLine
                {
                    MaterialCode = line.MaterialCode ?? string.Empty,
                    MaterialName = line.ProductName,
                    Sku = line.Sku,
                    Quantity = line.Quantity,
                    UnitOfMeasure = line.UnitOfMeasure,
                    UnitPrice = line.UnitPrice,
                    Currency = line.Currency,
                    StorageLocation = line.StorageLocation
                }).ToList()
            };

            ExternalCallResult result;
            try
            {
                result = await _buyerGateway.CreateBuyerPurchaseDocumentAsync(configuration, request, cancellationToken);
            }
            catch (Exception exception)
            {
                // The call broke off before an answer: the document may exist, so it is not sent again automatically.
                _logger.LogError($"Purchase order ERP call threw. PurchaseOrderId: {order.Id}, CorrelationId: {correlationId}, Error: {exception.Message}");
                result = new ExternalCallResult
                {
                    Succeeded = false,
                    OutcomeUnknown = true,
                    ErrorMessage = "The ERP call did not complete. The document may already exist, so check the ERP before retrying."
                };
            }

            if (result.Succeeded && !string.IsNullOrWhiteSpace(result.DocumentNumber))
            {
                integration.Status = Common.INTEGRATION_SUCCEEDED;
                integration.ExternalDocumentNumber = result.DocumentNumber;
                integration.ResponseBody = result.ResponseBody;
                integration.ErrorMessage = null;
                integration.OutcomeUnknown = false;
                integration.NextAttemptOn = null;
                order.ErpPurchaseOrderId = result.DocumentNumber;
                order.SourceSystem = configuration.SystemName;
                _logger.LogInfo(
                    $"Contract purchase order stored in the ERP. PurchaseOrderId={order.Id} ContractId={order.ContractId} System={configuration.SystemName} " +
                    $"ConfigurationId={configuration.ConfigurationId} CorrelationId={correlationId} DurationMs={result.DurationMs}");
            }
            else
            {
                integration.Status = result.OutcomeUnknown ? Common.INTEGRATION_UNKNOWN : Common.INTEGRATION_FAILED;
                integration.RetryCount += 1;
                integration.ErrorMessage = result.ErrorMessage ?? "Purchase order creation failed.";
                integration.OutcomeUnknown = result.OutcomeUnknown;
                integration.ResponseBody = result.ResponseBody;
                integration.NextAttemptOn = null;
                _logger.LogError(
                    $"Contract purchase order ERP call failed. PurchaseOrderId={order.Id} ContractId={order.ContractId} System={configuration.SystemName} " +
                    $"ConfigurationId={configuration.ConfigurationId} CorrelationId={correlationId} StatusCode={result.StatusCode}");
            }

            integration.LastAttemptOn = DateTime.UtcNow;
            await _repository.SaveAsync();
            return integration;
        }
    }
}

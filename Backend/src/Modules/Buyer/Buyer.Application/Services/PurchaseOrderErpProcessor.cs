using Buyer.Application.Contracts;
using Buyer.Application.Services.Integration;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.Contracts.IServices;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Dtos;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services
{
    /// <summary>
    /// Hands a saved purchase order to the two ERPs, in this order:
    /// 1. the buyer's ERP, through the buyer's active purchase order API (POST_PO), which returns the order number saved as the
    ///    order's ErpPurchaseOrderId;
    /// 2. the supplier's ERP, through the supplier's active sales order API (POST_SALES_ORDER, run by the Supplier service),
    ///    which returns the number saved as the order's SupplierErpSalesOrderNumber. The supplier's ERP receives the buyer ERP
    ///    number when there is one, otherwise the number of this system.
    /// The order exists before any of this and is never rolled back. Each hand-off keeps its outcome and its error on its own
    /// integration row, so a second call (Reprocess) does only what is left: a hand-off that succeeded is never sent again,
    /// and the supplier is not tried while the buyer ERP has not accepted the order.
    /// </summary>
    public class PurchaseOrderErpProcessor
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IBuyerPurchaseDocumentGateway _buyerGateway;
        private readonly ISupplierSalesOrderClient _supplierClient;
        private readonly IUserContext _userContext;
        private readonly ILoggerManager _logger;

        public PurchaseOrderErpProcessor(
            IRepositoryWrapper repository,
            IBuyerPurchaseDocumentGateway buyerGateway,
            ISupplierSalesOrderClient supplierClient,
            IUserContext userContext,
            ILoggerManager logger)
        {
            _repository = repository;
            _buyerGateway = buyerGateway;
            _supplierClient = supplierClient;
            _userContext = userContext;
            _logger = logger;
        }

        /// <summary>Where a hand-off stands: SYNCED, FAILED, UNKNOWN, PENDING or NOT_CONFIGURED.</summary>
        public static string LegStatus(string? documentNumber, PurchaseDocumentIntegration? row)
        {
            if (!string.IsNullOrWhiteSpace(documentNumber))
            {
                return Common.PURCHASE_ORDER_ERP_SYNCED;
            }

            if (row == null)
            {
                return Common.PURCHASE_ORDER_ERP_NOT_CONFIGURED;
            }

            return row.Status switch
            {
                Common.INTEGRATION_SUCCEEDED => Common.PURCHASE_ORDER_ERP_SYNCED,
                Common.INTEGRATION_FAILED => Common.PURCHASE_ORDER_ERP_FAILED,
                Common.INTEGRATION_UNKNOWN => Common.PURCHASE_ORDER_ERP_UNKNOWN,
                Common.INTEGRATION_NOT_CONFIGURED => Common.PURCHASE_ORDER_ERP_NOT_CONFIGURED,
                _ => Common.PURCHASE_ORDER_ERP_PENDING
            };
        }

        public static bool NeedsAttention(string legStatus)
        {
            return legStatus == Common.PURCHASE_ORDER_ERP_PENDING
                || legStatus == Common.PURCHASE_ORDER_ERP_FAILED
                || legStatus == Common.PURCHASE_ORDER_ERP_UNKNOWN;
        }

        public static PurchaseOrderProcessResultDto Describe(
            PurchaseOrder order, PurchaseDocumentIntegration? buyerRow, PurchaseDocumentIntegration? supplierRow)
        {
            string buyerStatus = LegStatus(order.ErpPurchaseOrderId, buyerRow);
            string supplierStatus = LegStatus(order.SupplierErpSalesOrderNumber, supplierRow);
            return new PurchaseOrderProcessResultDto
            {
                Id = order.Id,
                PoNumber = order.PoNumber,
                ErpPurchaseOrderId = order.ErpPurchaseOrderId,
                SupplierErpSalesOrderNumber = order.SupplierErpSalesOrderNumber,
                SupplierPurchaseOrderNumber = SupplierNumber(order),
                SupplierId = order.SupplierId,
                SupplierName = order.SupplierName,
                Status = order.Status,
                Currency = order.Currency,
                TotalAmount = order.TotalAmount,
                BuyerErpStatus = buyerStatus,
                BuyerErpError = ErrorOf(buyerStatus, buyerRow),
                SupplierErpStatus = supplierStatus,
                SupplierErpError = ErrorOf(supplierStatus, supplierRow),
                CanReprocess = NeedsAttention(buyerStatus) || NeedsAttention(supplierStatus)
            };
        }

        private static string SupplierNumber(PurchaseOrder order)
        {
            return string.IsNullOrWhiteSpace(order.ErpPurchaseOrderId) ? order.PoNumber : order.ErpPurchaseOrderId;
        }

        private static string? ErrorOf(string legStatus, PurchaseDocumentIntegration? row)
        {
            return legStatus == Common.PURCHASE_ORDER_ERP_FAILED || legStatus == Common.PURCHASE_ORDER_ERP_UNKNOWN
                ? row?.ErrorMessage
                : null;
        }

        /// <summary>
        /// Runs what is left of the two hand-offs and returns where they stand. A hand-off that fails is a result, not an
        /// exception.
        /// </summary>
        public async Task<PurchaseOrderProcessResultDto> ProcessAsync(Guid purchaseOrderId, Guid actorUserId, CancellationToken cancellationToken)
        {
            _userContext.SetCurrentUserId(actorUserId);
            PurchaseOrder? order = _repository.PurchaseOrder.FindFirstByCondition(x => x.Id == purchaseOrderId && x.IsActive);
            if (order == null)
            {
                _logger.LogError($"Purchase order not found while handing it to the ERPs. PurchaseOrderId: {purchaseOrderId}");
                throw new NotFoundCustomException("Purchase order not found.", "The purchase order does not exist.");
            }

            await SendToBuyerErpAsync(order, actorUserId, cancellationToken);

            string buyerStatus = LegStatus(order.ErpPurchaseOrderId, FindRow(order.Id, Common.ERP_OPERATION_PO_CREATE));
            if (NeedsAttention(buyerStatus))
            {
                // The supplier gets the buyer ERP number, so it waits until the buyer ERP has accepted the order.
                await HoldSupplierHandOffAsync(order, cancellationToken);
            }
            else
            {
                await SendToSupplierErpAsync(order, cancellationToken);
            }

            return Describe(
                _repository.PurchaseOrder.FindFirstByCondition(x => x.Id == order.Id)!,
                FindRow(order.Id, Common.ERP_OPERATION_PO_CREATE),
                FindRow(order.Id, Common.ERP_OPERATION_SUPPLIER_SALES_ORDER_CREATE));
        }

        private PurchaseDocumentIntegration? FindRow(Guid purchaseOrderId, string integrationType)
        {
            return _repository.PurchaseDocumentIntegration.FindFirstByCondition(
                x => x.PurchaseOrderId == purchaseOrderId && x.IntegrationType == integrationType && x.IsActive);
        }

        private PurchaseDocumentIntegration EnsureRow(PurchaseOrder order, string integrationType, string idempotencyKey, string documentType)
        {
            PurchaseDocumentIntegration? row = FindRow(order.Id, integrationType);
            if (row != null)
            {
                return row;
            }

            row = new PurchaseDocumentIntegration
            {
                Id = Guid.NewGuid(),
                PurchaseOrderId = order.Id,
                ContractId = order.ContractId,
                BuyerOrganizationId = order.BuyerOrganizationId,
                SupplierOrganizationId = order.SupplierId,
                IntegrationType = integrationType,
                IdempotencyKey = idempotencyKey,
                DocumentType = documentType,
                Status = Common.INTEGRATION_PENDING,
                IsActive = true
            };
            _repository.PurchaseDocumentIntegration.Create(row);
            return row;
        }

        // ---- 1. the buyer's ERP ------------------------------------------------------------------------------------------

        private async Task SendToBuyerErpAsync(PurchaseOrder order, Guid actorUserId, CancellationToken cancellationToken)
        {
            if (!string.IsNullOrWhiteSpace(order.ErpPurchaseOrderId))
            {
                _logger.LogInfo($"Purchase order is already in the buyer ERP. PurchaseOrderId: {order.Id}, ErpPurchaseOrderId: {order.ErpPurchaseOrderId}");
                return;
            }

            if (order.ContractId != null)
            {
                // An order of a contract has its own ERP body (the SAP S/4 order): its processor makes this call.
                PredefinedContract? contract = _repository.PredefinedContract.FindFirstByCondition(x => x.Id == order.ContractId && x.IsActive);
                await new ContractPurchaseOrderIntegrationProcessor(_repository, _buyerGateway, _userContext, _logger)
                    .SendAsync(order.Id, contract?.ContractNumber, actorUserId, cancellationToken);
                return;
            }

            IntegrationApiDto? configuration;
            try
            {
                configuration = await _buyerGateway.FindPurchaseOrderApiAsync(order.BuyerOrganizationId, order.CompanyCode, cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError($"The purchase order API could not be resolved. PurchaseOrderId: {order.Id}, Error: {exception.Message}");
                configuration = null;
            }

            if (configuration == null)
            {
                // No API: the order stays valid with no ERP number. A failed attempt of an earlier time is kept as it was.
                _logger.LogInfo($"No purchase order API is active. PurchaseOrderId: {order.Id}, BuyerOrganizationId: {order.BuyerOrganizationId}");
                return;
            }

            PurchaseDocumentIntegration row = EnsureRow(order, Common.ERP_OPERATION_PO_CREATE, $"po:{order.Id}", Common.ERP_DOCUMENT_PO);
            string correlationId = Guid.NewGuid().ToString("N");
            row.ConfigurationId = configuration.ConfigurationId;
            row.ConfigurationVersion = 1;
            row.ResolvedBaseUrl = configuration.BaseUrl ?? string.Empty;
            row.ResolvedPath = configuration.ResourcePath ?? string.Empty;
            row.ResolvedHttpMethod = configuration.HttpMethod ?? "POST";
            row.ResolvedErpType = configuration.SystemName ?? string.Empty;
            row.Status = Common.INTEGRATION_PROCESSING;
            row.CorrelationId = correlationId;
            row.LastAttemptOn = DateTime.UtcNow;
            await _repository.SaveAsync();

            List<PurchaseOrderItem> items = LinesOf(order);

            // An order with ERP details (a buyer ERP of the SAP S/4 kind) is sent in the shape of the S/4 purchase order API, built as
            // the orders of a contract are, from the details saved on the order and the API's own body template. An order without
            // them is sent in the standard shape.
            string? payload = null;
            if (!string.IsNullOrWhiteSpace(order.ErpRequestOptions))
            {
                payload = ContractPurchaseOrderPayload.Build(
                    order, items, ContractPurchaseOrderPayload.ReadOptions(order.ErpRequestOptions), configuration.RequestBody, null);
            }

            BuyerPurchaseDocumentRequest request = new BuyerPurchaseDocumentRequest
            {
                PayloadOverride = payload,
                IdempotencyKey = row.IdempotencyKey,
                PurchaseOrderId = order.Id,
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
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // The call broke off before an answer: the document may exist there.
                _logger.LogError($"Purchase order ERP call threw. PurchaseOrderId: {order.Id}, CorrelationId: {correlationId}, Error: {exception.Message}");
                result = new ExternalCallResult
                {
                    Succeeded = false,
                    OutcomeUnknown = true,
                    ErrorMessage = "The ERP call did not complete. The document may already exist, so check the ERP before reprocessing."
                };
            }

            if (result.Succeeded && !string.IsNullOrWhiteSpace(result.DocumentNumber))
            {
                row.Status = Common.INTEGRATION_SUCCEEDED;
                row.ExternalDocumentNumber = result.DocumentNumber;
                row.ResponseBody = result.ResponseBody;
                row.ErrorMessage = null;
                row.OutcomeUnknown = false;
                order.ErpPurchaseOrderId = result.DocumentNumber;
                order.SourceSystem = configuration.SystemName;
                _logger.LogInfo(
                    $"Purchase order stored in the buyer ERP. PurchaseOrderId={order.Id} System={configuration.SystemName} " +
                    $"ConfigurationId={configuration.ConfigurationId} CorrelationId={correlationId} DurationMs={result.DurationMs}");
            }
            else
            {
                row.Status = result.OutcomeUnknown ? Common.INTEGRATION_UNKNOWN : Common.INTEGRATION_FAILED;
                row.RetryCount += 1;
                row.ErrorMessage = result.ErrorMessage ?? "Purchase order creation failed.";
                row.OutcomeUnknown = result.OutcomeUnknown;
                row.ResponseBody = result.ResponseBody;
                _logger.LogError(
                    $"Purchase order buyer ERP call failed. PurchaseOrderId={order.Id} System={configuration.SystemName} " +
                    $"ConfigurationId={configuration.ConfigurationId} CorrelationId={correlationId} StatusCode={result.StatusCode}");
            }

            row.LastAttemptOn = DateTime.UtcNow;
            await _repository.SaveAsync();
        }

        // ---- 2. the supplier's ERP ---------------------------------------------------------------------------------------

        // The supplier is not tried yet: its row says PENDING, so a screen shows Reprocess, and the next run does it.
        private async Task HoldSupplierHandOffAsync(PurchaseOrder order, CancellationToken cancellationToken)
        {
            if (!string.IsNullOrWhiteSpace(order.SupplierErpSalesOrderNumber))
            {
                return;
            }

            PurchaseDocumentIntegration row = EnsureRow(order, Common.ERP_OPERATION_SUPPLIER_SALES_ORDER_CREATE, $"po-supplier:{order.Id}", Common.ERP_DOCUMENT_PO);
            if (row.Status != Common.INTEGRATION_FAILED && row.Status != Common.INTEGRATION_UNKNOWN)
            {
                row.Status = Common.INTEGRATION_PENDING;
            }

            await _repository.SaveAsync();
            _logger.LogInfo($"Supplier hand-off waits for the buyer ERP. PurchaseOrderId: {order.Id}");
        }

        private async Task SendToSupplierErpAsync(PurchaseOrder order, CancellationToken cancellationToken)
        {
            if (!string.IsNullOrWhiteSpace(order.SupplierErpSalesOrderNumber))
            {
                _logger.LogInfo($"Purchase order is already in the supplier ERP. PurchaseOrderId: {order.Id}, SupplierErpSalesOrderNumber: {order.SupplierErpSalesOrderNumber}");
                return;
            }

            PurchaseDocumentIntegration row = EnsureRow(order, Common.ERP_OPERATION_SUPPLIER_SALES_ORDER_CREATE, $"po-supplier:{order.Id}", Common.ERP_DOCUMENT_PO);
            string correlationId = Guid.NewGuid().ToString("N");
            row.Status = Common.INTEGRATION_PROCESSING;
            row.CorrelationId = correlationId;
            row.LastAttemptOn = DateTime.UtcNow;
            await _repository.SaveAsync();

            BuyerBusinessProfile? buyer = _repository.BuyerBusinessProfile.FindFirstByCondition(x => x.Id == order.BuyerId);
            List<PurchaseOrderItem> items = LinesOf(order);
            SupplierSalesOrderRequestDto request = new SupplierSalesOrderRequestDto
            {
                SupplierId = order.SupplierId,
                PurchaseOrderNumber = SupplierNumber(order),
                LocalPurchaseOrderNumber = order.PoNumber,
                BuyerOrganizationId = order.BuyerOrganizationId,
                BuyerName = buyer?.OrganizationName,
                CompanyCode = order.CompanyCode,
                PlantCode = order.PlantCode,
                Currency = order.Currency,
                OrderDate = order.OrderDate,
                DeliveryDate = order.DeliveryDate,
                TotalAmount = order.TotalAmount,
                IdempotencyKey = row.IdempotencyKey,
                CorrelationId = correlationId,
                Lines = items.Select(line => new SupplierSalesOrderLineDto
                {
                    LineNumber = line.LineNumber,
                    MaterialCode = line.MaterialCode,
                    Sku = line.Sku,
                    Description = line.ProductName,
                    Quantity = line.Quantity,
                    UnitOfMeasure = line.UnitOfMeasure,
                    UnitPrice = line.UnitPrice,
                    LineAmount = line.LineAmount,
                    Currency = line.Currency,
                    StorageLocation = line.StorageLocation
                }).ToList()
            };

            SupplierSalesOrderResultDto result;
            try
            {
                result = await _supplierClient.SendSalesOrderAsync(request, cancellationToken);
            }
            catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogError($"The supplier hand-off timed out. PurchaseOrderId: {order.Id}, CorrelationId: {correlationId}, Error: {exception.Message}");
                result = new SupplierSalesOrderResultDto
                {
                    Configured = true,
                    OutcomeUnknown = true,
                    ErrorMessage = "The supplier hand-off did not finish in time. The order may already be in the supplier ERP, so check it before reprocessing."
                };
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // The Supplier service could not be reached or refused the call: nothing reached the supplier's ERP.
                string? detail = (exception as BaseCustomException)?.Description;
                _logger.LogError($"The supplier hand-off failed. PurchaseOrderId: {order.Id}, CorrelationId: {correlationId}, Error: {exception.Message}{(detail != null ? $" | {detail}" : string.Empty)}");
                result = new SupplierSalesOrderResultDto
                {
                    Configured = true,
                    OutcomeUnknown = false,
                    ErrorMessage = detail ?? "The Supplier service could not take the purchase order."
                };
            }

            if (!result.Configured)
            {
                row.Status = Common.INTEGRATION_NOT_CONFIGURED;
                row.ErrorMessage = null;
                row.OutcomeUnknown = false;
                _logger.LogInfo($"The supplier has no active sales order API. PurchaseOrderId: {order.Id}, SupplierId: {order.SupplierId}");
            }
            else if (result.Succeeded && !string.IsNullOrWhiteSpace(result.DocumentNumber))
            {
                row.Status = Common.INTEGRATION_SUCCEEDED;
                row.ExternalDocumentNumber = result.DocumentNumber;
                row.ResponseBody = result.ResponseBody;
                row.ErrorMessage = null;
                row.OutcomeUnknown = false;
                row.ResolvedErpType = result.SystemName ?? string.Empty;
                order.SupplierErpSalesOrderNumber = result.DocumentNumber;
                _logger.LogInfo(
                    $"Purchase order stored in the supplier ERP. PurchaseOrderId={order.Id} SupplierId={order.SupplierId} System={result.SystemName} " +
                    $"CorrelationId={correlationId} DurationMs={result.DurationMs}");
            }
            else
            {
                row.Status = result.OutcomeUnknown ? Common.INTEGRATION_UNKNOWN : Common.INTEGRATION_FAILED;
                row.RetryCount += 1;
                row.ErrorMessage = result.ErrorMessage ?? "The supplier ERP did not accept the purchase order.";
                row.OutcomeUnknown = result.OutcomeUnknown;
                row.ResponseBody = result.ResponseBody;
                row.ResolvedErpType = result.SystemName ?? string.Empty;
                _logger.LogError(
                    $"Purchase order supplier ERP call failed. PurchaseOrderId={order.Id} SupplierId={order.SupplierId} System={result.SystemName} " +
                    $"CorrelationId={correlationId} StatusCode={result.StatusCode} Code={result.ErrorCode}");
            }

            row.LastAttemptOn = DateTime.UtcNow;
            await _repository.SaveAsync();
        }

        private List<PurchaseOrderItem> LinesOf(PurchaseOrder order)
        {
            return _repository.PurchaseOrderItem
                .FindByCondition(x => x.PurchaseOrderId == order.Id && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToList();
        }
    }
}

using System.Globalization;
using System.Text.Json;
using Buyer.Application.Features.Commands.SendIntegrationRequest;
using Buyer.Application.Features.Queries.ResolveIntegration;
using Buyer.Application.Features.Shared;
using Buyer.Application.Services.Integration;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.PostPendingErpPostings
{
    /// <summary>
    /// Each posting is sent and saved on its own, so a document that reached the ERP is never sent again because a later
    /// posting of the same run failed. A posting is retried by the next runs until it fails three times.
    /// </summary>
    public class PostPendingErpPostingsCommandHandler : IRequestHandler<PostPendingErpPostingsCommand, SilaErpPostingRunResultDto>
    {
        private const int MAX_ATTEMPTS = 3;
        private const int MAX_BATCH = 50;
        private const int ERROR_LIMIT = 1000;
        private const string AREA_GOODS_MOVEMENT = "GoodsMovement";
        private const string AREA_GRN = "Grn";
        private const string AREA_INVOICE = "Invoice";

        // Outcome of an invoice whose goods receipt is still on its way to the ERP: left PENDING for a later run.
        private const string WAITING = "WAITING";
        private const string ITEMS = "Items";

        // Names an ERP answer may carry the posted document number under (SAP material document, GRN number, ...).
        private static readonly string[] ReferenceNames = { "materialDocument", "MaterialDocument", "materialDocumentNumber", "grnNumber", "erpReference", "documentNumber", "reference" };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IMediator _mediator;

        public PostPendingErpPostingsCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IMediator mediator)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
        }

        public async Task<SilaErpPostingRunResultDto> Handle(PostPendingErpPostingsCommand request, CancellationToken cancellationToken)
        {
            int batchSize = request.BatchSize <= 0 ? MAX_BATCH : Math.Min(request.BatchSize, MAX_BATCH);
            List<Guid> postingIds = await _repository.InventoryErpPosting
                .FindByCondition(x => x.IsActive && x.Status == Common.SILA_POSTING_PENDING && (request.BuyerId == null || x.BuyerId == request.BuyerId))
                .OrderBy(x => x.DateCreated)
                .ThenBy(x => x.ReferenceType == Common.SILA_REF_INVOICE ? 1 : 0)
                .Take(batchSize)
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            SilaErpPostingRunResultDto result = new SilaErpPostingRunResultDto();
            if (postingIds.Count == 0)
            {
                return result;
            }

            _logger.LogInfo($"Posting inventory documents to the ERP. Pending: {postingIds.Count}, BuyerId: {request.BuyerId}");
            foreach (Guid postingId in postingIds)
            {
                cancellationToken.ThrowIfCancellationRequested();
                string status;
                try
                {
                    status = await PostOneAsync(postingId, cancellationToken);
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    _logger.LogError($"ERP posting failed unexpectedly. PostingId: {postingId}, Error: {SilaLogText.Short(exception.Message)}");
                    status = await RecordUnexpectedFailureAsync(postingId);
                }

                result.Processed++;
                switch (status)
                {
                    case var posted when posted == Common.SILA_POSTING_POSTED:
                        result.Posted++;
                        break;
                    case var skipped when skipped == Common.SILA_POSTING_SKIPPED:
                        result.Skipped++;
                        break;
                    case var failed when failed == Common.SILA_POSTING_FAILED:
                        result.Failed++;
                        break;
                    default:
                        result.Retrying++;
                        break;
                }
            }

            _logger.LogInfo($"Inventory documents posted to the ERP. Processed: {result.Processed}, Posted: {result.Posted}, Failed: {result.Failed}, Retrying: {result.Retrying}, Skipped: {result.Skipped}");
            return result;
        }

        private async Task<string> PostOneAsync(Guid postingId, CancellationToken cancellationToken)
        {
            InventoryErpPosting posting = await _repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == postingId);
            if (posting.Status != Common.SILA_POSTING_PENDING)
            {
                return posting.Status;
            }

            BuyerBusinessProfile? buyer = await _repository.BuyerBusinessProfile
                .FindByCondition(x => x.Id == posting.BuyerId)
                .FirstOrDefaultAsync(cancellationToken);
            bool isGrn = posting.ReferenceType == Common.SILA_REF_GRN;
            bool isInvoice = posting.ReferenceType == Common.SILA_REF_INVOICE;
            IntegrationProcessType processType = isGrn
                ? IntegrationProcessType.POST_GRN
                : isInvoice ? IntegrationProcessType.POST_INVOICE : IntegrationProcessType.POST_GOODS_MOVEMENT;
            if (buyer == null)
            {
                return await FinishAsync(posting, Common.SILA_POSTING_SKIPPED, null, "The buyer of this document no longer exists.", cancellationToken);
            }

            InventoryLocation? location = posting.LocationId == null
                ? null
                : await _repository.InventoryLocation.FindByCondition(x => x.Id == posting.LocationId.Value).FirstOrDefaultAsync(cancellationToken);
            BuyerProperty? property = location == null
                ? null
                : await _repository.BuyerProperty.FindByCondition(x => x.Id == location.PropertyId).FirstOrDefaultAsync(cancellationToken);

            // The API is chosen by company code (SAP for one, Ariba for another), falling back to the ALL API.
            posting.CompanyCode ??= string.IsNullOrWhiteSpace(property?.CompanyCode) ? null : property.CompanyCode.Trim();
            if (isInvoice)
            {
                string? blocked = await InvoiceBlockedByGrnAsync(posting, cancellationToken);
                if (blocked == WAITING)
                {
                    return WAITING;
                }

                if (blocked != null)
                {
                    return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, blocked, cancellationToken);
                }
            }

            IntegrationApiDto api = await _mediator.Send(new ResolveIntegrationQuery
            {
                OrganizationId = buyer.OrganizationId,
                ProcessType = processType,
                EntityCode = posting.CompanyCode
            }, cancellationToken);
            if (!api.Configured || api.ConfigurationId == null)
            {
                string scope = posting.CompanyCode == null ? string.Empty : $" for company code {posting.CompanyCode} (or ALL)";
                return await FinishAsync(posting, Common.SILA_POSTING_SKIPPED, null, $"No active {processType} API is configured{scope}.", cancellationToken);
            }

            ErpDocument? document = isGrn
                ? await BuildGrnAsync(posting, location, property, cancellationToken)
                : isInvoice
                    ? await BuildInvoiceAsync(posting, cancellationToken)
                    : await BuildMovementAsync(posting, location, property, cancellationToken);
            if (document == null)
            {
                return await FinishAsync(posting, Common.SILA_POSTING_SKIPPED, null, "The document has no lines to post.", cancellationToken);
            }

            List<ApiFieldMapping> mappings = await _repository.ApiFieldMapping
                .FindByCondition(x => x.ConfigurationId == api.ConfigurationId.Value && x.IsActive)
                .ToListAsync(cancellationToken);
            string area = isGrn ? AREA_GRN : isInvoice ? AREA_INVOICE : AREA_GOODS_MOVEMENT;
            string body = string.IsNullOrWhiteSpace(api.RequestBody)
                ? JsonSerializer.Serialize(ToPayload(area, document, mappings))
                : ApplyTemplate(api.RequestBody, area, document, mappings);

            IntegrationSendResultDto sent = await SendAsync(buyer.OrganizationId, api.ConfigurationId.Value, posting, body, cancellationToken);
            // The last call, sanitised, for the transaction tracker.
            posting.IntegrationSystem = api.SystemName ?? api.Name;
            posting.ErpHttpStatus = sent.Answered ? sent.StatusCode : null;
            posting.ErpRequestPayload = SilaErpPayload.Sanitise(body);
            posting.ErpResponsePayload = SilaErpPayload.Sanitise(sent.ResponseBody);
            bool succeeded = sent.Answered && sent.StatusCode >= 200 && sent.StatusCode < 300;
            if (succeeded)
            {
                return await FinishAsync(posting, Common.SILA_POSTING_POSTED, ReadReference(sent.ResponseBody), null, cancellationToken);
            }

            string error = sent.Answered
                ? $"The ERP returned HTTP {sent.StatusCode}.{Snippet(sent.ResponseBody)}"
                : sent.ErrorMessage ?? "The ERP could not be reached.";
            posting.Attempts++;

            // No clear answer (timeout, 5xx): the document may exist in the ERP. It is not sent again until a user reconciles it.
            if (sent.OutcomeUnknown)
            {
                _logger.LogError($"ERP posting outcome unknown. PostingId: {posting.Id}, Reference: {posting.ReferenceNumber}, StatusCode: {sent.StatusCode}, Code: {sent.ErrorCode}");
                return await FinishAsync(posting, Common.SILA_POSTING_UNKNOWN, null,
                    $"{error} The ERP gave no clear answer: check whether {posting.ReferenceNumber} exists in the ERP, then reconcile this posting.", cancellationToken);
            }

            string status = posting.Attempts >= MAX_ATTEMPTS ? Common.SILA_POSTING_FAILED : Common.SILA_POSTING_PENDING;
            _logger.LogError($"ERP posting was not accepted. PostingId: {posting.Id}, Reference: {posting.ReferenceNumber}, Attempts: {posting.Attempts}, StatusCode: {sent.StatusCode}, Code: {sent.ErrorCode}");
            return await FinishAsync(posting, status, null, error, cancellationToken);
        }

        private async Task<IntegrationSendResultDto> SendAsync(Guid organizationId, Guid configurationId, InventoryErpPosting posting, string body, CancellationToken cancellationToken)
        {
            Dictionary<string, string> headers = new Dictionary<string, string>
            {
                // The same posting always carries the same key, so an ERP that honours it does not post twice.
                [Common.IDEMPOTENCY_HEADER] = posting.Id.ToString(),
                ["X-Correlation-Id"] = posting.Id.ToString()
            };
            try
            {
                return await _mediator.Send(new SendIntegrationRequestCommand
                {
                    OrganizationId = organizationId,
                    ConfigurationId = configurationId,
                    Body = body,
                    Headers = headers
                }, cancellationToken);
            }
            catch (BaseCustomException exception)
            {
                // Refused before any call (the API is not active), so nothing was sent.
                _logger.LogError($"ERP posting was not sent. PostingId: {posting.Id}, ConfigurationId: {configurationId}, HttpStatus: {exception.Code}");
                return new IntegrationSendResultDto
                {
                    Answered = false,
                    StatusCode = exception.Code,
                    ErrorCode = "INTEGRATION_REFUSED",
                    ErrorMessage = "The API is not active. Activate it under Integrations."
                };
            }
        }

        // Records the outcome on the posting (and on its POS sale) and saves it.
        private async Task<string> FinishAsync(InventoryErpPosting posting, string status, string? erpReference, string? error, CancellationToken cancellationToken)
        {
            posting.Status = status;
            posting.ErrorMessage = error == null ? null : (error.Length > ERROR_LIMIT ? error[..ERROR_LIMIT] : error);
            if (status == Common.SILA_POSTING_POSTED)
            {
                posting.ErpReference = erpReference;
                posting.PostedOn = DateTime.UtcNow;
            }

            if (posting.ReferenceType == Common.SILA_REF_POS_SALE
                && (status == Common.SILA_POSTING_POSTED || status == Common.SILA_POSTING_FAILED))
            {
                await UpdatePosSalesAsync(posting, status == Common.SILA_POSTING_POSTED, cancellationToken);
            }

            await _repository.SaveAsync();
            if (status == Common.SILA_POSTING_POSTED)
            {
                _logger.LogInfo($"ERP posting done. PostingId: {posting.Id}, Reference: {posting.ReferenceNumber}, ErpReference: {erpReference}");
            }

            return status;
        }

        private async Task UpdatePosSalesAsync(InventoryErpPosting posting, bool posted, CancellationToken cancellationToken)
        {
            List<PosSalesTransaction> sales = await _repository.PosSalesTransaction
                .FindByCondition(x => x.BuyerId == posting.BuyerId && (x.ErpPostingId == posting.Id || x.Id == posting.ReferenceId))
                .ToListAsync(cancellationToken);
            foreach (PosSalesTransaction sale in sales)
            {
                sale.Status = posted ? Common.SILA_POS_POSTED : Common.SILA_POS_FAILED;
                sale.FailedStep = posted ? null : Common.SILA_POS_STEP_POST;
                sale.FailureMessage = posted ? null : posting.ErrorMessage;
                _repository.PosSalesTransaction.Update(sale);
            }

            if (!posted)
            {
                InventoryLedger ledger = new InventoryLedger(_repository, posting.BuyerId, Guid.Empty);
                await ledger.RaiseAlertAsync(new InventoryAlert
                {
                    AlertType = Common.SILA_ALERT_POS_POSTING_FAILED,
                    Severity = Common.SILA_SEVERITY_HIGH,
                    Title = $"POS sale not posted to the ERP: {posting.ReferenceNumber}",
                    Message = posting.ErrorMessage ?? "The ERP did not accept the POS consumption.",
                    LocationId = posting.LocationId,
                    ReferenceType = Common.SILA_REF_POS_SALE,
                    ReferenceId = posting.ReferenceId,
                    RecommendedAction = Common.SILA_ACTION_INVESTIGATE
                }, cancellationToken);
            }
        }

        // An exception left the context in an unknown state: drop it and count the attempt on a fresh copy.
        private async Task<string> RecordUnexpectedFailureAsync(Guid postingId)
        {
            try
            {
                _repository.InventoryErpPosting.DetachAllEntities();
                InventoryErpPosting posting = await _repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == postingId);
                posting.Attempts++;
                posting.Status = posting.Attempts >= MAX_ATTEMPTS ? Common.SILA_POSTING_FAILED : Common.SILA_POSTING_PENDING;
                posting.ErrorMessage = "The posting could not be prepared or sent. Check the document and the ERP API.";
                await _repository.SaveAsync();
                return posting.Status;
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError($"ERP posting failure could not be recorded. PostingId: {postingId}, Error: {SilaLogText.Short(exception.Message)}");
                return Common.SILA_POSTING_PENDING;
            }
        }

        // Stock movements of the document: one line per inventory transaction, with its direction and storage location.
        private async Task<ErpDocument?> BuildMovementAsync(InventoryErpPosting posting, InventoryLocation? location, BuyerProperty? property, CancellationToken cancellationToken)
        {
            List<InventoryTransaction> transactions = await _repository.InventoryTransaction
                .FindByCondition(x => x.BuyerId == posting.BuyerId && x.ReferenceType == posting.ReferenceType && x.ReferenceId == posting.ReferenceId && x.IsActive)
                .OrderBy(x => x.TransactionNumber)
                .ToListAsync(cancellationToken);
            if (transactions.Count == 0)
            {
                return null;
            }

            List<Guid> materialIds = transactions.Select(x => x.MaterialId).Distinct().ToList();
            List<Guid> locationIds = transactions.Select(x => x.LocationId).Distinct().ToList();
            Dictionary<Guid, string> materialCodes = await _repository.ItemBuyerMaster
                .FindByCondition(x => materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.MaterialCode, cancellationToken);
            Dictionary<Guid, InventoryLocation> locations = await _repository.InventoryLocation
                .FindByCondition(x => locationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            InventoryLocation? headerLocation = location ?? locations.GetValueOrDefault(transactions[0].LocationId);
            BuyerProperty? headerProperty = property ?? (headerLocation == null
                ? null
                : await _repository.BuyerProperty.FindByCondition(x => x.Id == headerLocation.PropertyId).FirstOrDefaultAsync(cancellationToken));

            ErpDocument document = new ErpDocument();
            document.Header.Add(("ReferenceNumber", posting.ReferenceNumber));
            document.Header.Add(("MovementType", posting.MovementType));
            document.Header.Add(("PostingDate", transactions.Max(x => x.BusinessDate).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)));
            document.Header.Add(("Plant", headerProperty?.PlantCode));
            document.Header.Add(("StorageLocation", headerLocation?.StorageLocationCode));
            document.Header.Add(("CompanyCode", headerProperty?.CompanyCode));
            foreach (InventoryTransaction transaction in transactions)
            {
                document.Items.Add(new List<(string, object?)>
                {
                    ("MaterialCode", materialCodes.GetValueOrDefault(transaction.MaterialId)),
                    ("Quantity", transaction.Quantity),
                    ("Uom", transaction.BaseUom),
                    ("Direction", transaction.Direction),
                    ("StorageLocation", locations.GetValueOrDefault(transaction.LocationId)?.StorageLocationCode),
                    ("CostCenter", null)
                });
            }

            return document;
        }

        // The goods receipt against its purchase order: the accepted quantity of each line.
        private async Task<ErpDocument?> BuildGrnAsync(InventoryErpPosting posting, InventoryLocation? location, BuyerProperty? property, CancellationToken cancellationToken)
        {
            GoodsReceipt? receipt = await _repository.GoodsReceipt
                .FindByCondition(x => x.Id == posting.ReferenceId && x.BuyerId == posting.BuyerId)
                .FirstOrDefaultAsync(cancellationToken);
            if (receipt == null)
            {
                return null;
            }

            List<GoodsReceiptItem> items = await _repository.GoodsReceiptItem
                .FindByCondition(x => x.GoodsReceiptId == receipt.Id && x.IsActive && x.AcceptedQty > 0)
                .ToListAsync(cancellationToken);
            if (items.Count == 0)
            {
                return null;
            }

            List<Guid> poItemIds = items.Select(x => x.PurchaseOrderItemId).ToList();
            Dictionary<Guid, int> lineNumbers = await _repository.PurchaseOrderItem
                .FindByCondition(x => poItemIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.LineNumber, cancellationToken);
            string? poPlant = await _repository.PurchaseOrder
                .FindByCondition(x => x.Id == receipt.PurchaseOrderId)
                .Select(x => x.PlantCode)
                .FirstOrDefaultAsync(cancellationToken);

            ErpDocument document = new ErpDocument();
            document.Header.Add(("PoNumber", receipt.PoNumber));
            document.Header.Add(("GrnNumber", receipt.GrnNumber));
            document.Header.Add(("PostingDate", receipt.DateCreated.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)));
            document.Header.Add(("Plant", string.IsNullOrWhiteSpace(poPlant) ? property?.PlantCode : poPlant));
            document.Header.Add(("StorageLocation", location?.StorageLocationCode));
            document.Header.Add(("DeliveryNote", receipt.DeliveryNote));
            foreach (GoodsReceiptItem item in items)
            {
                document.Items.Add(new List<(string, object?)>
                {
                    ("PoLineNumber", lineNumbers.TryGetValue(item.PurchaseOrderItemId, out int lineNumber) ? lineNumber : null),
                    ("MaterialCode", item.MaterialCode),
                    ("Quantity", item.AcceptedQty),
                    ("Uom", item.Uom)
                });
            }

            return document;
        }

        // An invoice follows its goods receipts: WAITING while one is on its way to the ERP, a message when one failed,
        // null when it can be posted (goods receipts posted, or not sent because the ERP has no goods receipt API).
        private async Task<string?> InvoiceBlockedByGrnAsync(InventoryErpPosting posting, CancellationToken cancellationToken)
        {
            List<GoodsReceipt> receipts = await _repository.GoodsReceipt
                .FindByCondition(x => x.BuyerId == posting.BuyerId && x.InvoiceId == posting.ReferenceId && x.IsActive && x.ErpPostingId != null)
                .ToListAsync(cancellationToken);
            List<Guid> grnPostingIds = receipts.Select(x => x.ErpPostingId!.Value).ToList();
            List<InventoryErpPosting> grnPostings = await _repository.InventoryErpPosting
                .FindByCondition(x => grnPostingIds.Contains(x.Id))
                .ToListAsync(cancellationToken);
            if (grnPostings.Any(x => x.Status == Common.SILA_POSTING_PENDING || x.Status == Common.SILA_POSTING_UNKNOWN))
            {
                return WAITING;
            }

            InventoryErpPosting? failed = grnPostings.FirstOrDefault(x => x.Status == Common.SILA_POSTING_FAILED);
            return failed == null
                ? null
                : $"Goods receipt {failed.ReferenceNumber} of this invoice was not posted to the ERP. Reprocess the goods receipt first, then this invoice.";
        }

        // The supplier invoice with its lines, the purchase order and the goods receipts it bills.
        private async Task<ErpDocument?> BuildInvoiceAsync(InventoryErpPosting posting, CancellationToken cancellationToken)
        {
            Invoice? invoice = await _repository.Invoice
                .FindByCondition(x => x.Id == posting.ReferenceId && x.BuyerId == posting.BuyerId && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (invoice == null)
            {
                return null;
            }

            List<InvoiceItem> items = await _repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToListAsync(cancellationToken);
            if (items.Count == 0)
            {
                return null;
            }

            List<Guid> poItemIds = items.Where(x => x.PurchaseOrderItemId != null).Select(x => x.PurchaseOrderItemId!.Value).ToList();
            Dictionary<Guid, PurchaseOrderItem> poItems = await _repository.PurchaseOrderItem
                .FindByCondition(x => poItemIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            string? supplierCode = invoice.SilaSupplierId == null
                ? null
                : await _repository.SilaSupplier.FindByCondition(x => x.Id == invoice.SilaSupplierId.Value).Select(x => x.SupplierCode).FirstOrDefaultAsync(cancellationToken);
            List<string> grnNumbers = await _repository.GoodsReceipt
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .OrderBy(x => x.DateCreated)
                .Select(x => x.GrnNumber)
                .ToListAsync(cancellationToken);

            ErpDocument document = new ErpDocument();
            document.Header.Add(("InvoiceNumber", invoice.InvoiceNumber));
            document.Header.Add(("InvoiceDate", invoice.InvoiceDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)));
            document.Header.Add(("SupplierCode", supplierCode));
            document.Header.Add(("SupplierName", invoice.SupplierName));
            document.Header.Add(("PoNumber", invoice.PoNumber));
            document.Header.Add(("GrnNumber", grnNumbers.Count == 0 ? null : string.Join(",", grnNumbers)));
            document.Header.Add(("CompanyCode", posting.CompanyCode));
            document.Header.Add(("Currency", invoice.Currency));
            document.Header.Add(("GrossAmount", invoice.GrossAmount));
            foreach (InvoiceItem item in items)
            {
                PurchaseOrderItem? poItem = item.PurchaseOrderItemId != null ? poItems.GetValueOrDefault(item.PurchaseOrderItemId.Value) : null;
                document.Items.Add(new List<(string, object?)>
                {
                    ("LineNumber", item.LineNumber),
                    ("PoLineNumber", poItem?.LineNumber),
                    ("MaterialCode", poItem?.MaterialCode),
                    ("Description", item.Description),
                    ("Quantity", item.Quantity),
                    ("UnitPrice", item.UnitPrice),
                    ("Amount", item.Amount)
                });
            }

            return document;
        }

        // The JSON payload: each field under its mapped ERP name, or its own name in camelCase.
        private static Dictionary<string, object?> ToPayload(string area, ErpDocument document, List<ApiFieldMapping> mappings)
        {
            Dictionary<string, object?> payload = Fields(area, document.Header, mappings);
            string itemsKey = mappings.FirstOrDefault(x => Same(x.TargetField, $"{area}.{ITEMS}"))?.SourceField ?? Camel(ITEMS);
            payload[itemsKey] = document.Items.Select(item => Fields($"{area}.{ITEMS}", item, mappings)).ToList();
            return payload;
        }

        private static Dictionary<string, object?> Fields(string prefix, List<(string Name, object? Value)> fields, List<ApiFieldMapping> mappings)
        {
            Dictionary<string, object?> result = new Dictionary<string, object?>();
            foreach ((string name, object? value) in fields)
            {
                ApiFieldMapping? mapping = mappings.FirstOrDefault(x => Same(x.TargetField, $"{prefix}.{name}"));
                result[mapping?.SourceField ?? Camel(name)] = Transform(value, mapping);
            }

            return result;
        }

        private static object? Transform(object? value, ApiFieldMapping? mapping)
        {
            if (mapping == null)
            {
                return value;
            }

            if ((value == null || (value is string empty && string.IsNullOrWhiteSpace(empty))) && !string.IsNullOrWhiteSpace(mapping.DefaultValue))
            {
                return mapping.DefaultValue;
            }

            if (value is not string text)
            {
                return value;
            }

            return mapping.Transformation switch
            {
                "TRIM" => text.Trim(),
                "UPPER" => text.ToUpperInvariant(),
                "LOWER" => text.ToLowerInvariant(),
                _ => text
            };
        }

        // A configured body: {{referenceNumber}}, {{plant}}, ... are replaced by the header values and {{items}} by the JSON lines.
        private static string ApplyTemplate(string template, string area, ErpDocument document, List<ApiFieldMapping> mappings)
        {
            string result = template;
            foreach ((string name, object? value) in document.Header)
            {
                string text = value switch
                {
                    null => string.Empty,
                    decimal number => number.ToString(CultureInfo.InvariantCulture),
                    _ => value.ToString() ?? string.Empty
                };
                result = result.Replace("{{" + Camel(name) + "}}", text);
            }

            string items = JsonSerializer.Serialize(document.Items.Select(item => Fields($"{area}.{ITEMS}", item, mappings)));
            return result.Replace("{{items}}", items);
        }

        private static string? ReadReference(string? body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return null;
            }

            try
            {
                using JsonDocument json = JsonDocument.Parse(body);
                JsonElement root = json.RootElement;
                // OData answers wrap the entity in "d".
                if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("d", out JsonElement wrapped) && wrapped.ValueKind == JsonValueKind.Object)
                {
                    root = wrapped;
                }

                if (root.ValueKind == JsonValueKind.Object)
                {
                    foreach (string name in ReferenceNames)
                    {
                        if (root.TryGetProperty(name, out JsonElement value) && value.ValueKind is JsonValueKind.String or JsonValueKind.Number)
                        {
                            string text = value.ToString();
                            if (!string.IsNullOrWhiteSpace(text))
                            {
                                return text;
                            }
                        }
                    }
                }
            }
            catch (JsonException)
            {
                return null;
            }

            return ExternalDocumentNumberReader.TryRead(body);
        }

        private static string Snippet(string? body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return string.Empty;
            }

            string text = body.Trim();
            return " " + (text.Length > 300 ? text[..300] : text);
        }

        private static bool Same(string left, string right)
        {
            return string.Equals(left.Trim(), right, StringComparison.OrdinalIgnoreCase);
        }

        private static string Camel(string name)
        {
            return char.ToLowerInvariant(name[0]) + name[1..];
        }

        // The header fields and lines of one document, in payload order.
        private sealed class ErpDocument
        {
            public List<(string Name, object? Value)> Header { get; } = new();
            public List<List<(string Name, object? Value)>> Items { get; } = new();
        }
    }
}

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
using Microsoft.Extensions.Configuration;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration;
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
        private readonly IConfiguration _configuration;

        public PostPendingErpPostingsCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IMediator mediator, IConfiguration configuration)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
            _configuration = configuration;
        }

        public async Task<SilaErpPostingRunResultDto> Handle(PostPendingErpPostingsCommand request, CancellationToken cancellationToken)
        {
            int batchSize = request.BatchSize <= 0 ? MAX_BATCH : Math.Min(request.BatchSize, MAX_BATCH);
            List<Guid> postingIds;
            if (request.PostingId != null)
            {
                postingIds = await _repository.InventoryErpPosting
                    .FindByCondition(x => x.Id == request.PostingId.Value && x.IsActive && x.Status == Common.SILA_POSTING_PENDING
                        && (request.BuyerId == null || x.BuyerId == request.BuyerId))
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken);
            }
            else
            {
                postingIds = await _repository.InventoryErpPosting
                    .FindByCondition(x => x.IsActive && x.Status == Common.SILA_POSTING_PENDING && (request.BuyerId == null || x.BuyerId == request.BuyerId))
                    .OrderBy(x => x.DateCreated)
                    .ThenBy(x => x.ReferenceType == Common.SILA_REF_INVOICE ? 1 : 0)
                    .Take(batchSize)
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken);
            }
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
                    case var failed when failed == Common.SILA_POSTING_FAILED || failed == Common.SILA_POSTING_FAILED_LOCAL:
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

            if (posting.ReferenceType == Common.SILA_REF_INVOICE_ATTACHMENT)
            {
                await SilaInvoiceAttachment.SendPendingAsync(
                    _repository, _logger, _mediator, _configuration[SilaInvoiceAttachment.PUBLIC_BASE], posting, Guid.Empty, cancellationToken);
                return posting.Status;
            }

            // A document number is already stored. Finish SILA only; do not send the movement again.
            if (SilaTrackerRules.ErpAlreadyAccepted(posting))
            {
                return await SilaPostingRecovery.FinalizeLocalAsync(_repository, _logger, posting, Guid.Empty, posting.ErrorMessage, cancellationToken, _configuration[Common.BASE_FOLDER_PATH], _mediator, _configuration[SilaInvoiceAttachment.PUBLIC_BASE]);
            }

            if (posting.ReferenceType == Common.SILA_REF_POS_SALE
                && (posting.MovementType == Common.SILA_MOVEMENT_CONSUMPTION
                    || posting.MovementType == SilaInventorySap.TYPE_Z01
                    || posting.MovementType == SilaInventorySap.TYPE_Z02))
            {
                return await PostConsumptionGroupAsync(posting, cancellationToken);
            }

            // Internal transfer is posted only through FIVE S4 - Transfer Stock. It must not use the goods-movement API.
            if (posting.ReferenceType == Common.SILA_REF_ITO)
            {
                return await PostTransferAsync(posting, cancellationToken);
            }

            if (posting.ReferenceType == Common.SILA_REF_STOCK_COUNT || posting.ReferenceType == Common.SILA_REF_ADJUSTMENT)
            {
                return await PostStockEffectAsync(posting, cancellationToken);
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

            bool stockCount = SilaStockCountSap.IsStockCount(posting.MovementType) && !isGrn && !isInvoice;
            IntegrationApiDto api = stockCount
                ? await ResolveStockCountApiAsync(buyer.OrganizationId, posting.CompanyCode, cancellationToken)
                : isInvoice
                    ? await ResolveInvoiceApiAsync(buyer.OrganizationId, posting.CompanyCode, cancellationToken)
                    : await _mediator.Send(new ResolveIntegrationQuery
                    {
                        OrganizationId = buyer.OrganizationId,
                        ProcessType = processType,
                        EntityCode = posting.CompanyCode
                    }, cancellationToken);
            if (!api.Configured || api.ConfigurationId == null)
            {
                string scope = posting.CompanyCode == null ? string.Empty : $" for company code {posting.CompanyCode} (or ALL)";
                string expected = isInvoice
                    ? SilaInvoiceLifecycle.API_INVOICE
                    : stockCount ? $"{IntegrationProcessType.UPDATE_STOCK} ({SilaStockCountSap.API_CONFIG_NAME}) or {processType}" : processType.ToString();
                return await FinishAsync(posting, Common.SILA_POSTING_SKIPPED, null, $"No active {expected} API is configured{scope}.", cancellationToken);
            }

            ErpDocument? document;
            if (isInvoice)
            {
                (document, string? blocked) = await BuildInvoiceAsync(posting, cancellationToken);
                if (blocked != null)
                {
                    return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, blocked, cancellationToken);
                }
            }
            else
            {
                document = isGrn
                    ? await BuildGrnAsync(posting, location, property, cancellationToken)
                    : await BuildMovementAsync(posting, location, property, cancellationToken);
            }

            if (document == null)
            {
                return await FinishAsync(posting, Common.SILA_POSTING_SKIPPED, null, "The document has no lines to post.", cancellationToken);
            }

            if (isInvoice)
            {
                string? accepted = await InvoiceAlreadyAcceptedAsync(posting, cancellationToken);
                if (accepted != null)
                {
                    return accepted;
                }

                string? blocked = await InvoiceReadyAsync(posting, document, api.RequestBody, cancellationToken);
                if (blocked != null)
                {
                    return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, blocked, cancellationToken);
                }
            }

            List<ApiFieldMapping> mappings = await _repository.ApiFieldMapping
                .FindByCondition(x => x.ConfigurationId == api.ConfigurationId.Value && x.IsActive)
                .ToListAsync(cancellationToken);
            string area = isGrn ? AREA_GRN : isInvoice ? AREA_INVOICE : AREA_GOODS_MOVEMENT;
            bool sapGrn = isGrn
                && string.IsNullOrWhiteSpace(api.RequestBody)
                && string.Equals(api.Name, SilaGrnSap.API_CONFIG_NAME, StringComparison.OrdinalIgnoreCase);
            bool sapShape = stockCount
                && string.IsNullOrWhiteSpace(api.RequestBody)
                && (string.Equals(api.Name, SilaStockCountSap.API_CONFIG_NAME, StringComparison.OrdinalIgnoreCase)
                    || api.ProcessType == IntegrationProcessType.UPDATE_STOCK);
            string? invoiceBody = null;
            if (isInvoice && string.Equals(api.Name, SilaInvoiceLifecycle.API_INVOICE, StringComparison.OrdinalIgnoreCase))
            {
                SilaInvoicePosting.Document invoiceDocument = new SilaInvoicePosting.Document();
                foreach ((string name, object? value) in document.Header)
                {
                    invoiceDocument.Header.Add((name, value));
                }

                foreach (List<(string Name, object? Value)> item in document.Items)
                {
                    invoiceDocument.Items.Add(item);
                }

                (string? built, List<string> missingFields) = SilaInvoicePosting.SupplierInvoiceRequest(api.RequestBody, invoiceDocument);
                if (missingFields.Count > 0)
                {
                    return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null,
                        SilaInvoiceLifecycle.MISSING + ". " + string.Join("; ", missingFields), cancellationToken);
                }

                invoiceBody = built;
            }

            string body = invoiceBody
                ?? (sapGrn
                ? SapGrnBody(document)
                : sapShape
                    ? StockCountSapBody(document)
                    : string.IsNullOrWhiteSpace(api.RequestBody)
                        ? JsonSerializer.Serialize(ToPayload(area, document, mappings))
                        : ApplyTemplate(api.RequestBody, area, document, mappings));

            IntegrationSendResultDto sent = await SendAsync(buyer.OrganizationId, api.ConfigurationId.Value, posting, body, cancellationToken);
            // The last call, sanitised, for the transaction tracker. Invoice postings keep the API configuration name.
            posting.IntegrationSystem = isInvoice ? api.Name : api.SystemName ?? api.Name;
            posting.ErpHttpStatus = sent.Answered ? sent.StatusCode : null;
            posting.ErpRequestPayload = SilaErpPayload.Sanitise(body);
            posting.ErpResponsePayload = SilaErpPayload.Sanitise(sent.ResponseBody);
            bool succeeded = sent.Answered && sent.StatusCode >= 200 && sent.StatusCode < 300;
            if (succeeded)
            {
                string? reference = isInvoice
                    ? SilaInvoicePosting.ReadSupplierInvoice(sent.ResponseBody) ?? ReadReference(sent.ResponseBody)
                    : ReadReference(sent.ResponseBody);
                return await FinishAsync(posting, Common.SILA_POSTING_POSTED, reference, null, cancellationToken);
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

        private const string HELD = "HELD";

        /// <summary>
        /// One goods-issue or positive-adjustment document per business date, plant, storage location and direction.
        /// A POSTING_UNKNOWN sibling blocks that group. A later sale is not attached to a document already posted.
        /// </summary>
        private async Task<string> PostConsumptionGroupAsync(InventoryErpPosting posting, CancellationToken cancellationToken)
        {
            List<InventoryErpPosting> related = await _repository.InventoryErpPosting
                .FindByCondition(x => x.BuyerId == posting.BuyerId && x.IsActive
                    && x.ReferenceType == Common.SILA_REF_POS_SALE
                    && (x.MovementType == Common.SILA_MOVEMENT_CONSUMPTION
                        || x.MovementType == SilaInventorySap.TYPE_Z01
                        || x.MovementType == SilaInventorySap.TYPE_Z02)
                    && (x.Status == Common.SILA_POSTING_PENDING || x.Status == Common.SILA_POSTING_UNKNOWN || x.Status == Common.SILA_POSTING_POSTED))
                .ToListAsync(cancellationToken);
            List<Guid> saleIds = related.Select(x => x.ReferenceId).Distinct().ToList();
            Dictionary<Guid, PosSalesTransaction> sales = saleIds.Count == 0
                ? new Dictionary<Guid, PosSalesTransaction>()
                : await _repository.PosSalesTransaction
                    .FindByCondition(x => x.BuyerId == posting.BuyerId && saleIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);
            List<Guid> locationIds = related.Where(x => x.LocationId != null).Select(x => x.LocationId!.Value).Distinct().ToList();
            Dictionary<Guid, InventoryLocation> locations = locationIds.Count == 0
                ? new Dictionary<Guid, InventoryLocation>()
                : await _repository.InventoryLocation.FindByCondition(x => locationIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            List<Guid> propertyIds = locations.Values.Select(x => x.PropertyId).Distinct().ToList();
            Dictionary<Guid, BuyerProperty> properties = propertyIds.Count == 0
                ? new Dictionary<Guid, BuyerProperty>()
                : await _repository.BuyerProperty.FindByCondition(x => propertyIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);

            string KeyOf(InventoryErpPosting row)
            {
                sales.TryGetValue(row.ReferenceId, out PosSalesTransaction? sale);
                DateTime date = (sale?.BusinessDate ?? row.DateCreated).Date;
                InventoryLocation? location = row.LocationId != null ? locations.GetValueOrDefault(row.LocationId.Value) : null;
                BuyerProperty? property = location != null ? properties.GetValueOrDefault(location.PropertyId) : null;
                string plant = property?.PlantCode?.Trim().ToUpperInvariant() ?? string.Empty;
                string storage = location?.StorageLocationCode?.Trim().ToUpperInvariant() ?? string.Empty;
                string movement = SilaInventorySap.MovementForSale(row.MovementType, sale?.QuantitySold ?? 0);
                return $"{date:yyyy-MM-dd}|{plant}|{storage}|{movement}";
            }

            string key = KeyOf(posting);
            List<InventoryErpPosting> group = related.Where(x => KeyOf(x) == key).ToList();
            if (group.Any(x => x.Status == Common.SILA_POSTING_UNKNOWN))
            {
                _logger.LogInfo($"POS SAP posting held because a posting in the group is unknown. Key: {key}, PostingId: {posting.Id}");
                return HELD;
            }

            List<InventoryErpPosting> pending = group.Where(x => x.Status == Common.SILA_POSTING_PENDING).ToList();
            if (pending.All(x => x.Id != posting.Id))
            {
                return posting.Status;
            }

            InventoryErpPosting? posted = group.FirstOrDefault(x => x.Status == Common.SILA_POSTING_POSTED && !string.IsNullOrWhiteSpace(x.ErpReference));
            if (posted != null)
            {
                // Rows created before that document were part of it. A later sale is a new document.
                List<InventoryErpPosting> earlier = pending
                    .Where(x => posted.PostedOn == null || x.DateCreated <= posted.PostedOn.Value)
                    .ToList();
                foreach (InventoryErpPosting row in earlier)
                {
                    row.IntegrationSystem = posted.IntegrationSystem;
                    row.ErpHttpStatus = posted.ErpHttpStatus;
                    row.ErpRequestPayload = posted.ErpRequestPayload;
                    row.ErpResponsePayload = posted.ErpResponsePayload;
                    await FinishAsync(row, Common.SILA_POSTING_POSTED, posted.ErpReference, null, cancellationToken);
                }

                pending = pending.Except(earlier).ToList();
                if (pending.Count == 0 || pending.All(x => x.Id != posting.Id))
                {
                    return posted.ErpReference == null ? posting.Status : Common.SILA_POSTING_POSTED;
                }
            }

            BuyerBusinessProfile? buyer = await _repository.BuyerBusinessProfile.FindByCondition(x => x.Id == posting.BuyerId).FirstOrDefaultAsync(cancellationToken);
            InventoryLocation? headerLocation = posting.LocationId == null ? null : locations.GetValueOrDefault(posting.LocationId.Value);
            BuyerProperty? headerProperty = headerLocation == null ? null : properties.GetValueOrDefault(headerLocation.PropertyId);
            posting.CompanyCode ??= string.IsNullOrWhiteSpace(headerProperty?.CompanyCode) ? null : headerProperty.CompanyCode.Trim();
            if (buyer == null)
            {
                return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, "The buyer of this document no longer exists.", cancellationToken);
            }

            string movement = SilaInventorySap.MovementForSale(posting.MovementType, sales.GetValueOrDefault(posting.ReferenceId)?.QuantitySold ?? 0);
            SilaInventorySap.Rule rule = movement == SilaInventorySap.TYPE_Z01 ? SilaInventorySap.PositiveAdjustment : SilaInventorySap.GoodsIssue;
            EffectPreparation prepared = await PrepareEffectAsync(
                posting, pending.Select(x => x.ReferenceId).ToList(), headerLocation, headerProperty, rule, buyer.OrganizationId, cancellationToken);
            string? body = prepared.Body;
            ApiIntegrationConfiguration? api = prepared.Api;
            if (prepared.Error != null || body == null || api == null)
            {
                string message = prepared.Error ?? "The document has no lines to post.";
                foreach (InventoryErpPosting row in pending)
                {
                    await FinishAsync(row, Common.SILA_POSTING_FAILED, null, message, cancellationToken);
                }

                return Common.SILA_POSTING_FAILED;
            }

            InventoryErpPosting leader = pending[0];
            IntegrationSendResultDto sent = await SendAsync(buyer.OrganizationId, api.Id, leader, body, cancellationToken);
            bool succeeded = sent.Answered && sent.StatusCode >= 200 && sent.StatusCode < 300;
            string status = succeeded
                ? Common.SILA_POSTING_POSTED
                : sent.OutcomeUnknown ? Common.SILA_POSTING_UNKNOWN : Common.SILA_POSTING_FAILED;
            string? reference = succeeded ? SilaInventorySap.ReadMaterialDocument(sent.ResponseBody) ?? ReadReference(sent.ResponseBody) : null;
            string? error = succeeded
                ? null
                : sent.Answered
                    ? $"The ERP returned HTTP {sent.StatusCode}.{Snippet(sent.ResponseBody)}"
                    : sent.ErrorMessage ?? "The ERP could not be reached.";
            error = SilaErpPayload.Sanitise(error) ?? error;
            if (sent.OutcomeUnknown)
            {
                error = $"{error} POSTING_UNKNOWN. The ERP gave no clear answer. This group is not sent again until it is reconciled.";
            }

            foreach (InventoryErpPosting row in pending)
            {
                row.IntegrationSystem = api.Name;
                row.MovementType = rule.GoodsMovementType;
                row.ErpHttpStatus = sent.Answered ? sent.StatusCode : null;
                row.ErpRequestPayload = SilaErpPayload.Sanitise(body);
                row.ErpResponsePayload = SilaErpPayload.Sanitise(sent.ResponseBody);
                row.CompanyCode ??= posting.CompanyCode;
                await FinishAsync(row, status, reference, error, cancellationToken);
            }

            return status;
        }

        /// <summary>
        /// Stock-count variance and manual adjustment. Shortage and surplus are separate material documents.
        /// A movement already recorded on the posting is not sent again.
        /// </summary>
        private async Task<string> PostStockEffectAsync(InventoryErpPosting posting, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile? buyer = await _repository.BuyerBusinessProfile.FindByCondition(x => x.Id == posting.BuyerId).FirstOrDefaultAsync(cancellationToken);
            if (buyer == null)
            {
                return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, "The buyer of this document no longer exists.", cancellationToken);
            }

            bool single = posting.MovementType == SilaInventorySap.TYPE_Z01 || posting.MovementType == SilaInventorySap.TYPE_Z02;
            if (single && !string.IsNullOrWhiteSpace(posting.ErpReference))
            {
                return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, SilaInventorySap.Failure(SilaInventorySap.ALREADY_POSTED), cancellationToken);
            }

            InventoryLocation? location = posting.LocationId == null
                ? null
                : await _repository.InventoryLocation.FindByCondition(x => x.Id == posting.LocationId.Value).FirstOrDefaultAsync(cancellationToken);
            BuyerProperty? property = location == null
                ? null
                : await _repository.BuyerProperty.FindByCondition(x => x.Id == location.PropertyId).FirstOrDefaultAsync(cancellationToken);
            posting.CompanyCode ??= string.IsNullOrWhiteSpace(property?.CompanyCode) ? null : property.CompanyCode.Trim();
            List<InventoryTransaction> transactions = await _repository.InventoryTransaction
                .FindByCondition(x => x.BuyerId == posting.BuyerId && x.IsActive && x.ReferenceType == posting.ReferenceType && x.ReferenceId == posting.ReferenceId)
                .ToListAsync(cancellationToken);
            string[] movements = single
                ? new[] { posting.MovementType }
                : new[] { SilaInventorySap.TYPE_Z02, SilaInventorySap.TYPE_Z01 };
            int directions = movements.Count(movement => transactions.Any(x => x.Direction == (movement == SilaInventorySap.TYPE_Z01 ? Common.SILA_DIRECTION_IN : Common.SILA_DIRECTION_OUT) && x.Quantity > 0));
            string? reference = posting.ErpReference;
            bool sentOne = false;
            foreach (string movement in movements)
            {
                if (SilaInventorySap.ReferenceHas(reference, movement))
                {
                    continue;
                }

                string direction = movement == SilaInventorySap.TYPE_Z01 ? Common.SILA_DIRECTION_IN : Common.SILA_DIRECTION_OUT;
                if (!transactions.Any(x => x.Direction == direction && x.Quantity > 0))
                {
                    continue;
                }

                SilaInventorySap.Rule rule = movement == SilaInventorySap.TYPE_Z01 ? SilaInventorySap.PositiveAdjustment : SilaInventorySap.GoodsIssue;
                EffectPreparation prepared = await PrepareEffectAsync(
                    posting, new List<Guid> { posting.ReferenceId }, location, property, rule, buyer.OrganizationId, cancellationToken);
                string? body = prepared.Body;
                ApiIntegrationConfiguration? api = prepared.Api;
                if (prepared.Error != null || body == null || api == null)
                {
                    return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, prepared.Error ?? "The document has no lines to post.", cancellationToken);
                }

                IntegrationSendResultDto sent = await SendAsync(buyer.OrganizationId, api.Id, posting, body, cancellationToken);
                posting.IntegrationSystem = api.Name;
                posting.ErpHttpStatus = sent.Answered ? sent.StatusCode : null;
                posting.ErpRequestPayload = SilaErpPayload.Sanitise(body);
                posting.ErpResponsePayload = SilaErpPayload.Sanitise(sent.ResponseBody);
                bool succeeded = sent.Answered && sent.StatusCode >= 200 && sent.StatusCode < 300;
                if (!succeeded)
                {
                    string error = sent.Answered
                        ? $"The ERP returned HTTP {sent.StatusCode}.{Snippet(sent.ResponseBody)}"
                        : sent.ErrorMessage ?? "The ERP could not be reached.";
                    error = SilaErpPayload.Sanitise(error) ?? error;
                    if (sent.OutcomeUnknown)
                    {
                        posting.ErpReference = reference;
                        return await FinishAsync(posting, Common.SILA_POSTING_UNKNOWN, null,
                            $"{error} POSTING_UNKNOWN. The ERP gave no clear answer. This posting is not sent again until it is reconciled.", cancellationToken);
                    }

                    posting.Attempts++;
                    posting.ErpReference = reference;
                    string status = posting.Attempts >= MAX_ATTEMPTS ? Common.SILA_POSTING_FAILED : Common.SILA_POSTING_PENDING;
                    return await FinishAsync(posting, status, null, error, cancellationToken);
                }

                string? document = SilaInventorySap.ReadMaterialDocument(sent.ResponseBody) ?? ReadReference(sent.ResponseBody);
                reference = directions > 1 && document != null
                    ? SilaInventorySap.JoinReference(reference, movement, document)
                    : document ?? reference;
                posting.ErpReference = reference;
                posting.MovementType = directions > 1 ? posting.MovementType : rule.GoodsMovementType;
                sentOne = true;
                if (directions > 1)
                {
                    await _repository.SaveAsync();
                }
            }

            if (!sentOne && string.IsNullOrWhiteSpace(reference))
            {
                return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, "The document has no lines to post.", cancellationToken);
            }

            return await FinishAsync(posting, Common.SILA_POSTING_POSTED, reference, null, cancellationToken);
        }

        /// <summary>Builds one positive-quantity material document for the rule. The error is ready to store.</summary>
        private async Task<EffectPreparation> PrepareEffectAsync(
            InventoryErpPosting posting,
            List<Guid> referenceIds,
            InventoryLocation? location,
            BuyerProperty? property,
            SilaInventorySap.Rule rule,
            Guid organizationId,
            CancellationToken cancellationToken)
        {
            string? body = null;
            ApiIntegrationConfiguration? api = null;
            string direction = rule.GoodsMovementType == SilaInventorySap.TYPE_Z01 ? Common.SILA_DIRECTION_IN : Common.SILA_DIRECTION_OUT;
            List<InventoryTransaction> transactions = await _repository.InventoryTransaction
                .FindByCondition(x => x.BuyerId == posting.BuyerId && x.IsActive
                    && x.ReferenceType == posting.ReferenceType
                    && referenceIds.Contains(x.ReferenceId)
                    && x.Direction == direction
                    && x.Quantity > 0)
                .ToListAsync(cancellationToken);
            if (transactions.Count == 0)
            {
                return new EffectPreparation("The document has no lines to post.", null, null);
            }

            List<Guid> materialIds = transactions.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = await _repository.ItemBuyerMaster
                .FindByCondition(x => materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(_repository, materialIds, cancellationToken);
            List<SilaInventorySap.TransferLine> lines = new List<SilaInventorySap.TransferLine>();
            foreach (InventoryTransaction transaction in transactions)
            {
                if (!materials.TryGetValue(transaction.MaterialId, out ItemBuyerMaster? material))
                {
                    return new EffectPreparation(SilaInventorySap.Failure(SilaInventorySap.MATERIAL_MAPPING_MISSING), null, null);
                }

                lines.Add(new SilaInventorySap.TransferLine(material, transaction.Quantity, transaction.BaseUom));
            }

            DateTime businessDate = transactions.Max(x => x.BusinessDate);
            string? problem = SilaInventorySap.TryBuildEffect(businessDate, property?.PlantCode, location?.StorageLocationCode, rule, lines, conversions, out body);
            if (problem != null)
            {
                return new EffectPreparation(SilaInventorySap.Failure(problem), null, null);
            }

            if (body == null)
            {
                return new EffectPreparation("The document has no lines to post.", null, null);
            }

            api = await SilaInventorySap.ResolveAsync(_repository, organizationId, rule.ApiName, posting.CompanyCode, cancellationToken);
            if (api == null)
            {
                return new EffectPreparation(SilaInventorySap.MissingApi(rule.ApiName), null, null);
            }

            return new EffectPreparation(null, body, api);
        }

        private readonly record struct EffectPreparation(string? Error, string? Body, ApiIntegrationConfiguration? Api);

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
            posting.ErrorMessage = error == null ? null : (error.Length > ERROR_LIMIT ? error[..ERROR_LIMIT] : error);
            if (status == Common.SILA_POSTING_POSTED)
            {
                // Persist the ERP document before any local completion. A later save failure must not send it again.
                posting.ErpReference = erpReference;
                posting.PostedOn = DateTime.UtcNow;
                posting.Status = Common.SILA_POSTING_ERP_ACCEPTED;
                posting.ErrorMessage = null;
                SilaInvoicePosting.RememberResponse(_repository, posting, Guid.Empty);
                await _repository.SaveAsync();
                return await SilaPostingRecovery.FinalizeLocalAsync(_repository, _logger, posting, Guid.Empty, null, cancellationToken, _configuration[Common.BASE_FOLDER_PATH], _mediator, _configuration[SilaInvoiceAttachment.PUBLIC_BASE]);
            }

            posting.Status = status;
            if (posting.ReferenceType == Common.SILA_REF_POS_SALE && status == Common.SILA_POSTING_FAILED)
            {
                await UpdatePosSalesAsync(posting, false, cancellationToken);
            }

            await SilaInvoicePosting.OnFinishedAsync(_repository, _logger, _configuration[Common.BASE_FOLDER_PATH], posting, status, cancellationToken);
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
                if (SilaTrackerRules.ErpAlreadyAccepted(posting))
                {
                    posting.Status = Common.SILA_POSTING_FAILED_LOCAL;
                    posting.ErrorMessage = SilaTrackerRules.LocalFailureMessage(posting.ErpReference);
                    await _repository.SaveAsync();
                    return posting.Status;
                }

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
            string postingDate = transactions.Max(x => x.BusinessDate).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            bool stockCount = SilaStockCountSap.UsesUpdateStock(posting.MovementType);
            document.Header.Add(("ReferenceNumber", posting.ReferenceNumber));
            document.Header.Add(("MovementType", posting.MovementType));
            document.Header.Add(("PostingDate", postingDate));
            document.Header.Add(("Plant", headerProperty?.PlantCode));
            document.Header.Add(("StorageLocation", headerLocation?.StorageLocationCode));
            document.Header.Add(("CompanyCode", headerProperty?.CompanyCode));
            if (stockCount)
            {
                document.Header.Add(("DocumentDate", postingDate));
                document.Header.Add(("GoodsMovementCode", SilaStockCountSap.GOODS_MOVEMENT_CODE));
            }

            foreach (InventoryTransaction transaction in transactions)
            {
                string? storageLocation = locations.GetValueOrDefault(transaction.LocationId)?.StorageLocationCode;
                string? materialCode = materialCodes.GetValueOrDefault(transaction.MaterialId);
                List<(string, object?)> line = new List<(string, object?)>
                {
                    ("MaterialCode", materialCode),
                    ("Quantity", SilaStockCountSap.AbsoluteQuantity(transaction.Quantity)),
                    ("Uom", transaction.BaseUom),
                    ("Direction", transaction.Direction),
                    ("StorageLocation", storageLocation),
                    ("CostCenter", null)
                };
                if (stockCount)
                {
                    line.Add(("Material", materialCode));
                    line.Add(("Plant", headerProperty?.PlantCode));
                    line.Add(("GoodsMovementType", SilaStockCountSap.GoodsMovementType(transaction.Direction)));
                    line.Add(("QuantityInEntryUnit", SilaStockCountSap.AbsoluteQuantity(transaction.Quantity)));
                    line.Add(("EntryUnit", transaction.BaseUom));
                }

                document.Items.Add(line);
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
            // S4 gets inventory (stocked) lines only; non-stock / service lines stay internal to the PO.
            List<Guid> materialIds = items.Where(x => x.MaterialId != null).Select(x => x.MaterialId!.Value).Distinct().ToList();
            HashSet<Guid> stockedMaterialIds = (await _repository.ItemBuyerMaster
                    .FindByCondition(x => materialIds.Contains(x.Id) && x.IsActive)
                    .ToListAsync(cancellationToken))
                .Where(SilaMaterialRules.HoldsStock)
                .Select(x => x.Id)
                .ToHashSet();
            items = items.Where(x => x.MaterialId != null && stockedMaterialIds.Contains(x.MaterialId.Value)).ToList();
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

            string plant = string.IsNullOrWhiteSpace(poPlant) ? property?.PlantCode : poPlant;
            DateTime receiptDate = DateTime.SpecifyKind(receipt.DateCreated.Date, DateTimeKind.Utc);
            string odataDate = $"/Date({new DateTimeOffset(receiptDate).ToUnixTimeMilliseconds()})/";
            ErpDocument document = new ErpDocument();
            document.Header.Add(("PoNumber", receipt.PoNumber));
            document.Header.Add(("GrnNumber", receipt.GrnNumber));
            document.Header.Add(("PostingDate", receipt.DateCreated.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)));
            document.Header.Add(("DocumentDate", odataDate));
            document.Header.Add(("ODataPostingDate", odataDate));
            document.Header.Add(("Plant", plant));
            document.Header.Add(("StorageLocation", location?.StorageLocationCode));
            document.Header.Add(("DeliveryNote", receipt.DeliveryNote));
            document.Header.Add(("GoodsMovementCode", SilaGrnSap.GOODS_MOVEMENT_CODE));
            foreach (GoodsReceiptItem item in items)
            {
                int? lineNumber = lineNumbers.TryGetValue(item.PurchaseOrderItemId, out int number) ? number : null;
                string purchaseOrderItem = lineNumber == null
                    ? string.Empty
                    : lineNumber.Value.ToString("00000", CultureInfo.InvariantCulture);
                document.Items.Add(new List<(string, object?)>
                {
                    ("PoLineNumber", lineNumber),
                    ("MaterialCode", item.MaterialCode),
                    ("Quantity", item.AcceptedQty),
                    ("Uom", item.Uom),
                    ("Material", item.MaterialCode),
                    ("Plant", plant),
                    ("GoodsMovementType", SilaGrnSap.GOODS_MOVEMENT_TYPE),
                    ("PurchaseOrder", receipt.PoNumber),
                    ("PurchaseOrderItem", purchaseOrderItem),
                    ("GoodsMovementRefDocType", SilaGrnSap.GOODS_MOVEMENT_REF_DOC_TYPE),
                    ("EntryUnit", item.Uom),
                    ("QuantityInEntryUnit", item.AcceptedQty.ToString(CultureInfo.InvariantCulture))
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

        // The body is built from the posting data stored on the invoice. Reprocess does not call GET PO.
        private async Task<(ErpDocument? Document, string? Blocked)> BuildInvoiceAsync(InventoryErpPosting posting, CancellationToken cancellationToken)
        {
            Invoice? invoice = await _repository.Invoice
                .FindByCondition(x => x.Id == posting.ReferenceId && x.BuyerId == posting.BuyerId && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (invoice == null)
            {
                return (null, "The invoice no longer exists.");
            }

            List<InvoiceItem> items = await _repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToListAsync(cancellationToken);
            SilaInvoicePostingData.Prepared? prepared = SilaInvoicePostingData.Read(invoice.PostingData);
            SilaInvoicePosting.Document? described = prepared == null
                ? await SilaInvoicePosting.DescribeAsync(_repository, posting.BuyerId, posting.ReferenceId, posting.CompanyCode, cancellationToken)
                : null;
            if (prepared != null)
            {
                string? blocked = SilaInvoicePostingData.BlockSend(prepared, invoice, items);
                if (blocked != null)
                {
                    return (null, blocked);
                }

                described = SilaInvoicePostingData.ToDocument(prepared);
            }

            if (described == null)
            {
                return (null, "The invoice has no lines to post.");
            }
            if (string.IsNullOrWhiteSpace(posting.CompanyCode) && !string.IsNullOrWhiteSpace(described.CompanyCode))
            {
                posting.CompanyCode = described.CompanyCode;
            }

            ErpDocument document = new ErpDocument();
            foreach ((string name, object? value) in described.Header)
            {
                document.Header.Add((name, value));
            }

            foreach (List<(string Name, object? Value)> item in described.Items)
            {
                document.Items.Add(item);
            }

            return (document, null);
        }

        /// <summary>Stops the send when the invoice or the API body is missing a value. Does not invent one.</summary>
        private async Task<string?> InvoiceReadyAsync(InventoryErpPosting posting, ErpDocument document, string? template, CancellationToken cancellationToken)
        {
            Invoice? invoice = await _repository.Invoice
                .FindByCondition(x => x.Id == posting.ReferenceId && x.BuyerId == posting.BuyerId && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (invoice == null)
            {
                return "The invoice no longer exists.";
            }

            List<InvoiceItem> items = await _repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            bool service = SilaReceivingRules.IsServiceInvoice(invoice);
            bool grnPosted = service || await _repository.GoodsReceipt
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.BuyerId == posting.BuyerId && x.IsActive)
                .AnyAsync(cancellationToken);
            List<string> missing = SilaInvoiceLifecycle.Missing(invoice, items, !service, grnPosted, posting.CompanyCode);
            missing.AddRange(SilaInvoiceLifecycle.MissingContract(template, SilaInvoicePosting.TextOf(document.Header)));
            if (missing.Count == 0)
            {
                return null;
            }

            return SilaInvoiceLifecycle.MISSING + ". " + string.Join("; ", missing);
        }

        /// <summary>A confirmed SAP invoice, or an unknown result, is not sent again.</summary>
        private async Task<string?> InvoiceAlreadyAcceptedAsync(InventoryErpPosting posting, CancellationToken cancellationToken)
        {
            List<InventoryErpPosting> others = await _repository.InventoryErpPosting
                .FindByCondition(x => x.Id != posting.Id && x.BuyerId == posting.BuyerId && x.IsActive
                    && x.ReferenceType == Common.SILA_REF_INVOICE && x.ReferenceId == posting.ReferenceId)
                .ToListAsync(cancellationToken);
            if (others.Any(x => x.Status == Common.SILA_POSTING_UNKNOWN))
            {
                return await FinishAsync(posting, Common.SILA_POSTING_UNKNOWN, null,
                    "Another posting of this invoice is POSTING_UNKNOWN. Reconcile it before SAP is called.", cancellationToken);
            }

            InventoryErpPosting? accepted = others.FirstOrDefault(SilaTrackerRules.ErpAlreadyAccepted);
            if (accepted == null && others.All(x => x.Status != Common.SILA_POSTING_POSTED))
            {
                return null;
            }

            accepted ??= others.First(x => x.Status == Common.SILA_POSTING_POSTED);
            posting.ErpReference ??= accepted.ErpReference;
            posting.Status = Common.SILA_POSTING_ERP_ACCEPTED;
            return await SilaPostingRecovery.FinalizeLocalAsync(
                _repository, _logger, posting, Guid.Empty, posting.ErrorMessage, cancellationToken, _configuration[Common.BASE_FOLDER_PATH], _mediator, _configuration[SilaInvoiceAttachment.PUBLIC_BASE]);
        }

        private async Task<IntegrationApiDto> ResolveInvoiceApiAsync(Guid organizationId, string? companyCode, CancellationToken cancellationToken)
        {
            ApiIntegrationConfiguration? configuration = await SilaInvoicePosting.FindInvoiceApiAsync(_repository, organizationId, companyCode, cancellationToken);
            if (configuration == null)
            {
                return new IntegrationApiDto { Configured = false };
            }

            return new IntegrationApiDto
            {
                Configured = true,
                ProcessType = IntegrationProcessType.POST_INVOICE,
                ConfigurationId = configuration.Id,
                Name = configuration.Name,
                SystemName = configuration.SystemName,
                EntityCode = configuration.EntityCode,
                BaseUrl = configuration.BaseUrl,
                ResourcePath = configuration.ResourcePath,
                HttpMethod = configuration.HttpMethod,
                PayloadFormat = configuration.PayloadFormat,
                RequestBody = configuration.RequestBody
            };
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

        /// <summary>
        /// One FIVE S4 - Transfer Stock call for the transfer. The request is built from the transfer lines.
        /// A missing API or a data error fails once and does not use another API. An unclear answer is UNKNOWN.
        /// </summary>
        private async Task<string> PostTransferAsync(InventoryErpPosting posting, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile? buyer = await _repository.BuyerBusinessProfile
                .FindByCondition(x => x.Id == posting.BuyerId)
                .FirstOrDefaultAsync(cancellationToken);
            if (buyer == null)
            {
                return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, "The buyer of this document no longer exists.", cancellationToken);
            }

            InternalTransferOrder? transfer = await _repository.InternalTransferOrder
                .FindByCondition(x => x.Id == posting.ReferenceId && x.BuyerId == posting.BuyerId && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (transfer == null)
            {
                return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, "Transfer not found.", cancellationToken);
            }

            if (!SilaTransferSap.MovesStock(transfer.Status))
            {
                return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, "The transfer is not in a state that moves stock.", cancellationToken);
            }

            bool alreadyPosted = await _repository.InventoryErpPosting
                .FindByCondition(x => x.Id != posting.Id && x.BuyerId == posting.BuyerId && x.IsActive
                    && x.ReferenceType == Common.SILA_REF_ITO && x.ReferenceId == posting.ReferenceId
                    && x.Status == Common.SILA_POSTING_POSTED)
                .AnyAsync(cancellationToken);
            if (alreadyPosted || !string.IsNullOrWhiteSpace(posting.ErpReference))
            {
                return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, SilaTransferSap.Failure(SilaTransferSap.TRANSFER_ALREADY_POSTED), cancellationToken);
            }

            bool unknown = await _repository.InventoryErpPosting
                .FindByCondition(x => x.Id != posting.Id && x.BuyerId == posting.BuyerId && x.IsActive
                    && x.ReferenceType == Common.SILA_REF_ITO && x.ReferenceId == posting.ReferenceId
                    && x.Status == Common.SILA_POSTING_UNKNOWN)
                .AnyAsync(cancellationToken);
            if (unknown)
            {
                _logger.LogError($"Transfer SAP posting held. PostingId: {posting.Id}, Reference: {posting.ReferenceNumber}");
                return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null,
                    "POSTING_UNKNOWN. A posting for this transfer has an unknown SAP result. Reconcile it before sending again.", cancellationToken);
            }

            InventoryLocation? from = await _repository.InventoryLocation.FindFirstByConditionAsync(x => x.Id == transfer.FromLocationId);
            InventoryLocation? to = await _repository.InventoryLocation.FindFirstByConditionAsync(x => x.Id == transfer.ToLocationId);
            BuyerProperty? fromProperty = from == null ? null : await _repository.BuyerProperty.FindFirstByConditionAsync(x => x.Id == from.PropertyId);
            BuyerProperty? toProperty = to == null ? null : await _repository.BuyerProperty.FindFirstByConditionAsync(x => x.Id == to.PropertyId);
            posting.CompanyCode ??= string.IsNullOrWhiteSpace(fromProperty?.CompanyCode) ? null : fromProperty.CompanyCode.Trim();

            List<InternalTransferOrderItem> items = await _repository.InternalTransferOrderItem
                .FindByCondition(x => x.InternalTransferOrderId == transfer.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            List<Guid> materialIds = items.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = materialIds.Count == 0
                ? new Dictionary<Guid, ItemBuyerMaster>()
                : await _repository.ItemBuyerMaster.FindByCondition(x => materialIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(_repository, materialIds, cancellationToken);
            string? problem = SilaTransferSap.TryPrepare(transfer, from, to, fromProperty, toProperty, items, materials, conversions, out string? body, out SilaInventorySap.Rule? rule);
            if (problem != null)
            {
                return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, SilaTransferSap.Failure(problem), cancellationToken);
            }

            if (body == null || rule == null)
            {
                return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, "The transfer has no quantity to post.", cancellationToken);
            }

            posting.MovementType = rule.GoodsMovementType;
            ApiIntegrationConfiguration? api = await SilaInventorySap.ResolveAsync(_repository, buyer.OrganizationId, rule.ApiName, posting.CompanyCode, cancellationToken);
            if (api == null)
            {
                return await FinishAsync(posting, Common.SILA_POSTING_FAILED, null, SilaInventorySap.MissingApi(rule.ApiName), cancellationToken);
            }

            IntegrationSendResultDto sent = await SendAsync(buyer.OrganizationId, api.Id, posting, body, cancellationToken);
            posting.IntegrationSystem = api.Name;
            posting.ErpHttpStatus = sent.Answered ? sent.StatusCode : null;
            posting.ErpRequestPayload = SilaErpPayload.Sanitise(body);
            posting.ErpResponsePayload = SilaErpPayload.Sanitise(sent.ResponseBody);
            bool succeeded = sent.Answered && sent.StatusCode >= 200 && sent.StatusCode < 300;
            if (succeeded)
            {
                string? reference = SilaTransferSap.ReadMaterialDocument(sent.ResponseBody) ?? ReadReference(sent.ResponseBody);
                return await FinishAsync(posting, Common.SILA_POSTING_POSTED, reference, null, cancellationToken);
            }

            string error = sent.Answered
                ? $"The ERP returned HTTP {sent.StatusCode}.{Snippet(sent.ResponseBody)}"
                : sent.ErrorMessage ?? "The ERP could not be reached.";
            error = SilaErpPayload.Sanitise(error) ?? error;
            posting.Attempts++;
            if (sent.OutcomeUnknown)
            {
                _logger.LogError($"Transfer SAP posting outcome unknown. PostingId: {posting.Id}, Reference: {posting.ReferenceNumber}, StatusCode: {sent.StatusCode}, Code: {sent.ErrorCode}");
                return await FinishAsync(posting, Common.SILA_POSTING_UNKNOWN, null,
                    $"{error} The ERP gave no clear answer: check whether {posting.ReferenceNumber} exists in the ERP, then reconcile this posting. It is not sent again automatically.", cancellationToken);
            }

            string status = posting.Attempts >= MAX_ATTEMPTS ? Common.SILA_POSTING_FAILED : Common.SILA_POSTING_PENDING;
            _logger.LogError($"Transfer SAP posting was not accepted. PostingId: {posting.Id}, Reference: {posting.ReferenceNumber}, Attempts: {posting.Attempts}, StatusCode: {sent.StatusCode}, Code: {sent.ErrorCode}");
            return await FinishAsync(posting, status, null, error, cancellationToken);
        }

        // Stock count prefers the tested UPDATE_STOCK config named FIVE_POS_UPDATE, then any UPDATE_STOCK API, then a goods movement API.
        private async Task<IntegrationApiDto> ResolveStockCountApiAsync(Guid organizationId, string? companyCode, CancellationToken cancellationToken)
        {
            List<ApiIntegrationConfiguration> named = await _repository.ApiIntegrationConfiguration
                .FindByCondition(x => IntegrationLookup.BuyerIdsOf(_repository, organizationId).Contains(x.BuyerId)
                    && x.IsActive
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.Name == SilaStockCountSap.API_CONFIG_NAME)
                .ToListAsync(cancellationToken);
            ApiIntegrationConfiguration? match = MatchEntity(named, companyCode);
            if (match != null)
            {
                return ToApi(match);
            }

            IntegrationApiDto updateStock = await _mediator.Send(new ResolveIntegrationQuery
            {
                OrganizationId = organizationId,
                ProcessType = IntegrationProcessType.UPDATE_STOCK,
                EntityCode = companyCode
            }, cancellationToken);
            if (updateStock.Configured)
            {
                return updateStock;
            }

            return await _mediator.Send(new ResolveIntegrationQuery
            {
                OrganizationId = organizationId,
                ProcessType = IntegrationProcessType.POST_GOODS_MOVEMENT,
                EntityCode = companyCode
            }, cancellationToken);
        }

        private static ApiIntegrationConfiguration? MatchEntity(List<ApiIntegrationConfiguration> configurations, string? companyCode)
        {
            return configurations.FirstOrDefault(x => companyCode != null && x.EntityCode.Equals(companyCode, StringComparison.OrdinalIgnoreCase))
                ?? configurations.FirstOrDefault(x => x.EntityCode.Equals(IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase))
                ?? (companyCode == null ? configurations.OrderBy(x => x.DateCreated).FirstOrDefault() : null);
        }

        private static IntegrationApiDto ToApi(ApiIntegrationConfiguration configuration)
        {
            return new IntegrationApiDto
            {
                Configured = true,
                ProcessType = Enum.Parse<IntegrationProcessType>(configuration.ProcessType),
                ConfigurationId = configuration.Id,
                Name = configuration.Name,
                SystemName = configuration.SystemName,
                EntityCode = configuration.EntityCode,
                BaseUrl = configuration.BaseUrl,
                ResourcePath = configuration.ResourcePath,
                HttpMethod = configuration.HttpMethod,
                PayloadFormat = configuration.PayloadFormat,
                RequestBody = configuration.RequestBody
            };
        }

        // SAP material document for a stock count. Quantity is absolute. Credentials stay on the API configuration.
        private static string StockCountSapBody(ErpDocument document)
        {
            string? Header(string name)
            {
                return document.Header.FirstOrDefault(x => x.Name == name).Value?.ToString();
            }

            var items = document.Items.Select(item =>
            {
                object? Value(string name)
                {
                    return item.FirstOrDefault(x => x.Name == name).Value;
                }

                return new
                {
                    Plant = Value("Plant"),
                    StorageLocation = Value("StorageLocation"),
                    Material = Value("Material"),
                    GoodsMovementType = Value("GoodsMovementType"),
                    QuantityInEntryUnit = Value("QuantityInEntryUnit"),
                    EntryUnit = Value("EntryUnit")
                };
            }).ToList();

            return JsonSerializer.Serialize(new
            {
                PostingDate = Header("PostingDate"),
                DocumentDate = Header("DocumentDate"),
                GoodsMovementCode = SilaStockCountSap.GOODS_MOVEMENT_CODE,
                to_MaterialDocumentItem = items
            });
        }

        // SAP material document for a goods receipt (previous SILAME S4HanaPostGrnAdapter shape).
        private static string SapGrnBody(ErpDocument document)
        {
            string? Header(string name)
            {
                return document.Header.FirstOrDefault(x => x.Name == name).Value?.ToString();
            }

            var items = document.Items.Select(item =>
            {
                object? Value(string name)
                {
                    return item.FirstOrDefault(x => x.Name == name).Value;
                }

                return new
                {
                    Material = Value("Material"),
                    Plant = Value("Plant"),
                    GoodsMovementType = Value("GoodsMovementType"),
                    PurchaseOrder = Value("PurchaseOrder"),
                    PurchaseOrderItem = Value("PurchaseOrderItem"),
                    GoodsMovementRefDocType = Value("GoodsMovementRefDocType"),
                    EntryUnit = Value("EntryUnit"),
                    QuantityInEntryUnit = Value("QuantityInEntryUnit")
                };
            }).ToList();

            return JsonSerializer.Serialize(new
            {
                DocumentDate = Header("DocumentDate"),
                PostingDate = Header("ODataPostingDate") ?? Header("DocumentDate"),
                GoodsMovementCode = Header("GoodsMovementCode") ?? SilaGrnSap.GOODS_MOVEMENT_CODE,
                MaterialDocumentHeaderText = Header("GrnNumber"),
                to_MaterialDocumentItem = items
            });
        }

        // The header fields and lines of one document, in payload order.
        private sealed class ErpDocument
        {
            public List<(string Name, object? Value)> Header { get; } = new();
            public List<List<(string Name, object? Value)>> Items { get; } = new();
        }
    }
}

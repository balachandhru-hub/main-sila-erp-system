using System.Globalization;
using Buyer.Application.Features.Commands.SendIntegrationRequest;
using Buyer.Application.Features.Queries.ResolveIntegration;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ReverseSilaGoodsReceipt
{
    public class ReverseSilaGoodsReceiptCommandHandler : IRequestHandler<ReverseSilaGoodsReceiptCommand, SilaReceivingGrnReversalResultDto>
    {
        private const decimal TOLERANCE = 0.0001m;
        private const string EVENT_REVERSAL_VALIDATION = "REVERSAL_VALIDATION";
        private const string EVENT_INVOICE_REVERSAL = "INVOICE_REVERSAL";
        private const string EVENT_GRN_REVERSAL = "GRN_REVERSAL";
        private const string EVENT_LOCAL_INVENTORY = "LOCAL_INVENTORY_REVERSAL";
        private const string EVENT_FINALIZATION = "FINALIZATION";

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IMediator _mediator;

        public ReverseSilaGoodsReceiptCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IMediator mediator)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
        }

        public Task<SilaReceivingGrnReversalResultDto> Handle(ReverseSilaGoodsReceiptCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(ReverseSilaGoodsReceiptCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<SilaReceivingGrnReversalResultDto> HandleOnceAsync(ReverseSilaGoodsReceiptCommand request, CancellationToken cancellationToken)
        {
            SilaReceivingGrnReversalWriteDto input = request.Request ?? new SilaReceivingGrnReversalWriteDto();
            SilaInputRules.Required(_logger, input.Reason, 500, "reversal reason");
            SilaInputRules.MaxLength(_logger, input.Remarks, 1000, "remarks");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            GoodsReceipt receipt = await _repository.GoodsReceipt
                .FindByCondition(x => x.Id == request.GoodsReceiptId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundCustomException("GRN_NOT_FOUND", "That goods receipt was not found.");

            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, receipt.LocationId, cancellationToken);

            if (string.IsNullOrWhiteSpace(receipt.MaterialDocument) && receipt.ErpPostingId != null)
            {
                InventoryErpPosting? original = await _repository.InventoryErpPosting
                    .FindByCondition(x => x.Id == receipt.ErpPostingId.Value)
                    .FirstOrDefaultAsync(cancellationToken);
                if (original != null)
                {
                    (string? md, string? year) = SilaGrnSap.ReadMaterialDocument(original.ErpResponsePayload, original.ErpReference);
                    receipt.MaterialDocument ??= md;
                    receipt.MaterialDocumentYear ??= year;
                }
            }

            Invoice? invoice = null;
            if (receipt.InvoiceId != null)
            {
                invoice = await _repository.Invoice
                    .FindByCondition(x => x.Id == receipt.InvoiceId && x.BuyerId == buyer.Id && x.IsActive)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            string invoiceGate = SilaReceivingReversal.InvoiceGate(invoice?.Status);
            bool invoiceBlocks = SilaReceivingReversal.InvoiceBlocksGrn(invoiceGate);
            bool alreadyFullyReversed = string.Equals(receipt.Status, Common.SILA_GRN_REVERSED, StringComparison.OrdinalIgnoreCase);
            bool needsLocal = SilaReceivingReversal.NeedsLocalFinalization(
                receipt.Status, receipt.ReversalStatus, receipt.ReversalMaterialDocument);

            if (input.LocalFinalizationOnly || needsLocal)
            {
                return await FinalizeLocalOnlyAsync(buyer, receipt, request.UserId, input.Reason, cancellationToken);
            }

            if (string.Equals(receipt.ReversalStatus, Common.SILA_POSTING_UNKNOWN, StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestCustomException(
                    "GRN_REVERSAL_POSTING_UNKNOWN",
                    "GRN reversal outcome is unknown. Reconcile with SAP before retrying. Do not reverse local inventory.");
            }

            if (alreadyFullyReversed)
            {
                throw new BadRequestCustomException(
                    "GRN_ALREADY_FULLY_REVERSED",
                    "This goods receipt is already fully reversed.");
            }

            if (!SilaReceivingReversal.IsReversalEligibleStatus(receipt.Status))
            {
                throw new BadRequestCustomException(
                    "GRN_NOT_POSTED",
                    "Only a posted or partially reversed goods receipt can be reversed. Current status: " + receipt.Status + ".");
            }

            Record(buyer.Id, receipt.Id, request.UserId, EVENT_REVERSAL_VALIDATION,
                $"InvoiceGate={invoiceGate}; MD={receipt.MaterialDocument}/{receipt.MaterialDocumentYear}");

            if (invoiceBlocks)
            {
                Record(buyer.Id, receipt.Id, request.UserId, EVENT_INVOICE_REVERSAL, $"Blocked: InvoiceGate={invoiceGate}");
                if (invoiceGate is "INVOICE_REVERSAL_FAILED" or "INVOICE_REVERSAL_UNKNOWN")
                {
                    throw new BadRequestCustomException(
                        "INVOICE_MUST_BE_REVERSED_FIRST",
                        invoiceGate == "INVOICE_REVERSAL_UNKNOWN"
                            ? "Invoice reversal outcome is unknown. Reconcile before reversing the Goods Receipt. FIVE S4-GRN REVERSAL was not called."
                            : "Invoice reversal failed. Reprocess invoice reversal before reversing the Goods Receipt. FIVE S4-GRN REVERSAL was not called.");
                }

                if (!input.ReverseInvoiceAndGrn)
                {
                    throw new BadRequestCustomException(
                        "INVOICE_MUST_BE_REVERSED_FIRST",
                        "This Goods Receipt has already been invoiced. The SAP Supplier Invoice must be reversed before the Goods Receipt can be reversed.");
                }

                throw new BadRequestCustomException(
                    "INVOICE_MUST_BE_REVERSED_FIRST",
                    "Invoice reversal is not configured on this tenant. Reverse the SAP Supplier Invoice first, then reprocess GRN reversal. FIVE S4-GRN REVERSAL was not called.");
            }

            if (string.IsNullOrWhiteSpace(receipt.MaterialDocument) || string.IsNullOrWhiteSpace(receipt.MaterialDocumentYear))
            {
                throw new BadRequestCustomException(
                    "GRN_REVERSAL_REQUIRED_FIELD_MISSING",
                    "Original SAP Material Document is not stored on this GRN. Cannot reverse.");
            }

            IntegrationApiDto api = await _mediator.Send(new ResolveIntegrationQuery
            {
                OrganizationId = request.OrganizationId,
                ProcessType = IntegrationProcessType.POST_GRN_REVERSAL,
                EntityCode = null
            }, cancellationToken);
            if (!api.Configured || api.ConfigurationId == null || api.ConfigurationId == Guid.Empty
                || !SilaGrnSap.IsReversalConfiguredName(api.Name))
            {
                throw new BadRequestCustomException(
                    "GRN_REVERSAL_INTEGRATION_NOT_CONFIGURED",
                    "No active integration named FIVE S4-GRN REVERSAL (API type POST_GRN_REVERSAL) is configured.");
            }

            List<GoodsReceiptItem> items = await _repository.GoodsReceiptItem
                .FindByCondition(x => x.GoodsReceiptId == receipt.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, GoodsReceiptItem> itemsById = items.ToDictionary(x => x.Id);

            List<(GoodsReceiptItem Item, decimal Qty)> selected = ResolveSelectedLines(input, itemsById);
            if (selected.Count == 0)
            {
                throw new BadRequestCustomException(
                    "GRN_REVERSAL_REQUIRED_FIELD_MISSING",
                    "Select at least one line with Reversal Qty greater than zero.");
            }

            List<GoodsReceiptItem> eligible = items.Where(x => x.AcceptedQty - x.ReversedQty > TOLERANCE).ToList();
            bool isFullRemaining = eligible.Count == selected.Count
                && selected.All(x => Math.Abs(x.Qty - Math.Max(0, x.Item.AcceptedQty - x.Item.ReversedQty)) <= TOLERANCE);

            InventoryLocation? location = await _repository.InventoryLocation
                .FindByCondition(x => x.Id == receipt.LocationId && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            BuyerProperty? property = location == null
                ? null
                : await _repository.BuyerProperty
                    .FindByCondition(x => x.Id == location.PropertyId && x.IsActive)
                    .FirstOrDefaultAsync(cancellationToken);
            PurchaseOrder? purchaseOrder = await _repository.PurchaseOrder
                .FindByCondition(x => x.Id == receipt.PurchaseOrderId)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new BadRequestCustomException("GRN_REVERSAL_REQUIRED_FIELD_MISSING", "Original purchase order was not found for this GRN.");

            string? plant = !string.IsNullOrWhiteSpace(purchaseOrder.PlantCode)
                ? purchaseOrder.PlantCode!.Trim()
                : !string.IsNullOrWhiteSpace(property?.PlantCode)
                    ? property!.PlantCode!.Trim()
                    : string.IsNullOrWhiteSpace(purchaseOrder.CompanyCode) ? null : purchaseOrder.CompanyCode!.Trim();
            if (string.IsNullOrWhiteSpace(plant))
            {
                throw new BadRequestCustomException("GRN_REVERSAL_REQUIRED_FIELD_MISSING", "Plant is missing on the original GRN / PO / property.");
            }

            string? defaultSloc = location?.StorageLocationCode?.Trim();
            List<Guid> poItemIds = selected.Select(x => x.Item.PurchaseOrderItemId).Distinct().ToList();
            Dictionary<Guid, PurchaseOrderItem> poItems = await _repository.PurchaseOrderItem
                .FindByCondition(x => poItemIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);

            DateTime postingDate = (input.PostingDate ?? DateTime.UtcNow).Date;
            DateTime documentDate = (input.DocumentDate ?? postingDate).Date;

            List<SilaGrnReversalSapLine> sapLines = new List<SilaGrnReversalSapLine>();
            foreach ((GoodsReceiptItem item, decimal qty) in selected)
            {
                if (string.IsNullOrWhiteSpace(item.MaterialCode))
                {
                    throw new BadRequestCustomException("GRN_REVERSAL_REQUIRED_FIELD_MISSING",
                        "Material is missing on GRN line " + item.Id.ToString("D") + ".");
                }

                if (string.IsNullOrWhiteSpace(item.Uom))
                {
                    throw new BadRequestCustomException("GRN_REVERSAL_REQUIRED_FIELD_MISSING",
                        "UOM is missing on GRN line " + item.Id.ToString("D") + ".");
                }

                if (!poItems.TryGetValue(item.PurchaseOrderItemId, out PurchaseOrderItem? poItem))
                {
                    throw new BadRequestCustomException("GRN_REVERSAL_REQUIRED_FIELD_MISSING",
                        "PO item was not found for GRN line " + item.Id.ToString("D") + ".");
                }

                string sloc = !string.IsNullOrWhiteSpace(poItem.StorageLocation)
                    ? poItem.StorageLocation!.Trim()
                    : defaultSloc ?? string.Empty;
                if (string.IsNullOrWhiteSpace(sloc))
                {
                    throw new BadRequestCustomException("GRN_REVERSAL_REQUIRED_FIELD_MISSING",
                        "Storage Location is missing for material " + item.MaterialCode + ".");
                }

                if (string.IsNullOrWhiteSpace(receipt.PoNumber))
                {
                    throw new BadRequestCustomException("GRN_REVERSAL_REQUIRED_FIELD_MISSING", "Purchase order number is missing on the GRN.");
                }

                sapLines.Add(new SilaGrnReversalSapLine
                {
                    Material = item.MaterialCode!,
                    Plant = plant!,
                    StorageLocation = sloc,
                    Quantity = qty,
                    EntryUnit = item.Uom!,
                    PurchaseOrder = receipt.PoNumber.Trim(),
                    PurchaseOrderItem = SilaGrnSap.FormatPurchaseOrderItem(poItem.LineNumber)
                });
            }

            string body = SilaGrnSap.ReversalBody(postingDate, documentDate, isFullRemaining, null, sapLines);

            // New posting attempt when previous is terminal success/failure; reuse only FAILED for reprocess of same attempt.
            InventoryErpPosting? reversalPosting = null;
            if (receipt.ReversalErpPostingId != null)
            {
                reversalPosting = await _repository.InventoryErpPosting
                    .FindByCondition(x => x.Id == receipt.ReversalErpPostingId.Value)
                    .FirstOrDefaultAsync(cancellationToken);
                if (reversalPosting != null
                    && (reversalPosting.Status == Common.SILA_POSTING_POSTED
                        || reversalPosting.Status == Common.SILA_POSTING_ERP_ACCEPTED))
                {
                    // Previous reversal completed (or needs local finalize handled above). Start a new attempt.
                    reversalPosting = null;
                }
                else if (reversalPosting?.Status == Common.SILA_POSTING_UNKNOWN)
                {
                    throw new BadRequestCustomException(
                        "GRN_REVERSAL_POSTING_UNKNOWN",
                        "A previous FIVE S4-GRN REVERSAL call may have reached SAP. Reconcile before retrying.");
                }
            }

            if (reversalPosting == null)
            {
                reversalPosting = new InventoryErpPosting
                {
                    Id = Guid.NewGuid(),
                    BuyerId = buyer.Id,
                    ReferenceType = Common.SILA_REF_GRN_REVERSAL,
                    ReferenceId = receipt.Id,
                    ReferenceNumber = receipt.GrnNumber,
                    LocationId = receipt.LocationId,
                    MovementType = Common.SILA_MOVEMENT_GRN_REVERSAL,
                    Status = Common.SILA_POSTING_PENDING,
                    Attempts = 0,
                    CompanyCode = api.EntityCode == IntegrationConstants.ENTITY_CODE_ALL ? null : api.EntityCode,
                    IntegrationSystem = api.SystemName,
                    IsActive = true
                };
                _repository.InventoryErpPosting.Create(reversalPosting);
                receipt.ReversalErpPostingId = reversalPosting.Id;
            }

            receipt.ReversalReason = string.IsNullOrWhiteSpace(input.Remarks)
                ? input.Reason.Trim()
                : $"{input.Reason.Trim()} — {input.Remarks.Trim()}";
            receipt.ReversalStatus = Common.SILA_POSTING_PENDING;
            receipt.ReversedBy = request.UserId;
            _repository.GoodsReceipt.Update(receipt);
            await _repository.SaveAsync();

            Record(buyer.Id, receipt.Id, request.UserId, EVENT_GRN_REVERSAL,
                $"Calling {SilaGrnSap.REVERSAL_API_CONFIG_NAME} for {selected.Count} line(s); original MD {receipt.MaterialDocument}/{receipt.MaterialDocumentYear}");

            reversalPosting.Attempts++;
            reversalPosting.ErpRequestPayload = body.Length > 4000 ? body[..4000] : body;
            IntegrationSendResultDto send = await _mediator.Send(new SendIntegrationRequestCommand
            {
                OrganizationId = request.OrganizationId,
                ConfigurationId = api.ConfigurationId.Value,
                Body = body,
                Headers = new Dictionary<string, string>
                {
                    [Common.IDEMPOTENCY_HEADER] = reversalPosting.Id.ToString(),
                    ["X-Correlation-Id"] = reversalPosting.Id.ToString()
                },
                ResponseLimit = 8000
            }, cancellationToken);

            reversalPosting.ErpHttpStatus = send.StatusCode;
            reversalPosting.ErpResponsePayload = send.ResponseBody;
            reversalPosting.IntegrationSystem = api.SystemName ?? reversalPosting.IntegrationSystem;

            if (send.OutcomeUnknown || (!send.Answered && send.OutcomeUnknown))
            {
                reversalPosting.Status = Common.SILA_POSTING_UNKNOWN;
                reversalPosting.ErrorMessage = send.ErrorMessage ?? "GRN_REVERSAL_POSTING_UNKNOWN";
                receipt.ReversalStatus = Common.SILA_POSTING_UNKNOWN;
                _repository.InventoryErpPosting.Update(reversalPosting);
                _repository.GoodsReceipt.Update(receipt);
                await _repository.SaveAsync();
                throw new BadRequestCustomException(
                    "GRN_REVERSAL_POSTING_UNKNOWN",
                    "FIVE S4-GRN REVERSAL may have reached SAP but the outcome is uncertain. Reconcile before retrying. Local inventory was not changed.");
            }

            if (!send.Answered || send.StatusCode < 200 || send.StatusCode >= 300)
            {
                string sapError = send.ErrorMessage ?? $"HTTP {send.StatusCode}";
                reversalPosting.Status = Common.SILA_POSTING_FAILED;
                reversalPosting.ErrorMessage = sapError.Length > 2000 ? sapError[..2000] : sapError;
                receipt.ReversalStatus = Common.SILA_POSTING_FAILED;
                _repository.InventoryErpPosting.Update(reversalPosting);
                _repository.GoodsReceipt.Update(receipt);
                await _repository.SaveAsync();
                throw new BadRequestCustomException(
                    "GRN_REVERSAL_SAP_FAILED",
                    $"FIVE S4-GRN REVERSAL failed. GRN remains {(receipt.Status)}. {sapError}");
            }

            (string? reversalMd, string? reversalYear) = SilaGrnSap.ReadMaterialDocument(send.ResponseBody, send.DocumentNumber);
            reversalPosting.ErpReference = reversalMd ?? send.DocumentNumber;
            reversalPosting.Status = Common.SILA_POSTING_ERP_ACCEPTED;
            reversalPosting.PostedOn = DateTime.UtcNow;
            reversalPosting.ErrorMessage = null;
            receipt.ReversalMaterialDocument = reversalPosting.ErpReference;
            receipt.ReversalMaterialDocumentYear = reversalYear ?? receipt.MaterialDocumentYear;
            receipt.ReversalStatus = Common.SILA_POSTING_ERP_ACCEPTED;
            _repository.InventoryErpPosting.Update(reversalPosting);
            _repository.GoodsReceipt.Update(receipt);
            await _repository.SaveAsync();

            try
            {
                await ApplyLocalReversalAsync(buyer, receipt, request.UserId, selected, cancellationToken);
                reversalPosting.Status = Common.SILA_POSTING_POSTED;
                receipt.ReversalStatus = Common.SILA_POSTING_POSTED;
                receipt.ReversedOn = DateTime.UtcNow;
                bool fullyReversed = items.All(x => x.AcceptedQty - x.ReversedQty <= TOLERANCE);
                receipt.Status = fullyReversed ? Common.SILA_GRN_REVERSED : Common.SILA_GRN_PARTIALLY_REVERSED;
                _repository.InventoryErpPosting.Update(reversalPosting);
                _repository.GoodsReceipt.Update(receipt);
                await InvalidateOpenInvoiceAsync(invoice, cancellationToken);
                Record(buyer.Id, receipt.Id, request.UserId, EVENT_FINALIZATION,
                    $"Reversed MD {receipt.ReversalMaterialDocument}; status {receipt.Status}");
                await _repository.SaveAsync();
                return Result(receipt, fullyReversed
                    ? "Goods receipt fully reversed via FIVE S4-GRN REVERSAL (102) and local inventory updated."
                    : "Goods receipt partially reversed via FIVE S4-GRN REVERSAL (102) and local inventory updated.");
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError($"Local GRN reversal finalization failed after SAP success. GoodsReceiptId: {receipt.Id}, Error: {SilaLogText.Short(exception.Message)}");
                reversalPosting.Status = Common.SILA_POSTING_FAILED_LOCAL;
                receipt.ReversalStatus = Common.SILA_POSTING_FAILED_LOCAL;
                receipt.ReversalMaterialDocument = reversalPosting.ErpReference;
                _repository.InventoryErpPosting.Update(reversalPosting);
                _repository.GoodsReceipt.Update(receipt);
                await _repository.SaveAsync();
                throw new BadRequestCustomException(
                    "GRN_REVERSAL_LOCAL_FINALIZATION_FAILED",
                    "SAP FIVE S4-GRN REVERSAL succeeded but local inventory finalization failed. Reprocess with local-finalization-only. Do not call FIVE S4-GRN REVERSAL again.");
            }
        }

        private List<(GoodsReceiptItem Item, decimal Qty)> ResolveSelectedLines(
            SilaReceivingGrnReversalWriteDto input,
            Dictionary<Guid, GoodsReceiptItem> itemsById)
        {
            List<(GoodsReceiptItem Item, decimal Qty)> selected = new List<(GoodsReceiptItem, decimal)>();
            if (input.Lines == null || input.Lines.Count == 0)
            {
                foreach (GoodsReceiptItem item in itemsById.Values.OrderBy(x => x.DateCreated))
                {
                    decimal remaining = Math.Max(0, item.AcceptedQty - item.ReversedQty);
                    if (remaining > TOLERANCE)
                    {
                        selected.Add((item, remaining));
                    }
                }

                return selected;
            }

            foreach (SilaReceivingGrnReversalLineWriteDto line in input.Lines)
            {
                if (!itemsById.TryGetValue(line.GoodsReceiptItemId, out GoodsReceiptItem? item))
                {
                    throw new BadRequestCustomException(
                        "GRN_LINE_NOT_FOUND",
                        "GRN line " + line.GoodsReceiptItemId.ToString("D") + " was not found on this goods receipt.");
                }

                if (line.ReversalQuantity < 0)
                {
                    throw new BadRequestCustomException(
                        "GRN_REVERSAL_REQUIRED_FIELD_MISSING",
                        "Reversal quantity cannot be negative for material " + (item.MaterialCode ?? item.MaterialName) + ".");
                }

                if (line.ReversalQuantity <= TOLERANCE)
                {
                    continue;
                }

                decimal remaining = Math.Max(0, item.AcceptedQty - item.ReversedQty);
                if (line.ReversalQuantity > remaining + TOLERANCE)
                {
                    throw new BadRequestCustomException(
                        "GRN_REVERSAL_QUANTITY_EXCEEDS_AVAILABLE",
                        $"Reversal quantity {line.ReversalQuantity.ToString(CultureInfo.InvariantCulture)} exceeds remaining reversible {remaining.ToString(CultureInfo.InvariantCulture)} for material {item.MaterialCode ?? item.MaterialName}.");
                }

                selected.Add((item, line.ReversalQuantity));
            }

            return selected;
        }

        private async Task<SilaReceivingGrnReversalResultDto> FinalizeLocalOnlyAsync(
            BuyerBusinessProfile buyer, GoodsReceipt receipt, Guid userId, string reason, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(receipt.ReversalMaterialDocument)
                && receipt.ReversalStatus != Common.SILA_POSTING_ERP_ACCEPTED
                && receipt.ReversalStatus != Common.SILA_POSTING_FAILED_LOCAL)
            {
                throw new BadRequestCustomException(
                    "GRN_REVERSAL_LOCAL_FINALIZATION_FAILED",
                    "Local-only finalization requires a confirmed SAP FIVE S4-GRN REVERSAL success first.");
            }

            InventoryErpPosting? posting = receipt.ReversalErpPostingId == null
                ? null
                : await _repository.InventoryErpPosting
                    .FindByCondition(x => x.Id == receipt.ReversalErpPostingId.Value)
                    .FirstOrDefaultAsync(cancellationToken);

            List<GoodsReceiptItem> items = await _repository.GoodsReceiptItem
                .FindByCondition(x => x.GoodsReceiptId == receipt.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            List<(GoodsReceiptItem Item, decimal Qty)> selected = ResolveQuantitiesFromPosting(posting, items);

            receipt.ReversalReason ??= reason.Trim();
            await ApplyLocalReversalAsync(buyer, receipt, userId, selected, cancellationToken);
            if (posting != null)
            {
                posting.Status = Common.SILA_POSTING_POSTED;
                posting.ErrorMessage = null;
                _repository.InventoryErpPosting.Update(posting);
            }

            receipt.ReversalStatus = Common.SILA_POSTING_POSTED;
            bool fullyReversed = items.All(x => x.AcceptedQty - x.ReversedQty <= TOLERANCE);
            receipt.Status = fullyReversed ? Common.SILA_GRN_REVERSED : Common.SILA_GRN_PARTIALLY_REVERSED;
            receipt.ReversedOn = DateTime.UtcNow;
            receipt.ReversedBy = userId;
            _repository.GoodsReceipt.Update(receipt);
            Invoice? invoice = receipt.InvoiceId == null
                ? null
                : await _repository.Invoice.FindByCondition(x => x.Id == receipt.InvoiceId && x.IsActive).FirstOrDefaultAsync(cancellationToken);
            await InvalidateOpenInvoiceAsync(invoice, cancellationToken);
            Record(buyer.Id, receipt.Id, userId, EVENT_FINALIZATION, "Local finalization only");
            await _repository.SaveAsync();
            return Result(receipt, "Local inventory finalization completed. SAP was not called again.");
        }

        private List<(GoodsReceiptItem Item, decimal Qty)> ResolveQuantitiesFromPosting(
            InventoryErpPosting? posting, List<GoodsReceiptItem> items)
        {
            List<(string Material, string PurchaseOrderItem, decimal Quantity)> parsed =
                SilaGrnSap.ReadReversalQuantities(posting?.ErpRequestPayload);
            if (parsed.Count == 0)
            {
                // Fallback: reverse all remaining (legacy Cancel path).
                return items
                    .Select(item => (item, Math.Max(0, item.AcceptedQty - item.ReversedQty)))
                    .Where(x => x.Item2 > TOLERANCE)
                    .Select(x => (x.Item1, x.Item2))
                    .ToList();
            }

            // Match by material + remaining; PO item formatting matched via PurchaseOrderItem lookup when possible.
            List<(GoodsReceiptItem Item, decimal Qty)> selected = new List<(GoodsReceiptItem, decimal)>();
            HashSet<Guid> used = new HashSet<Guid>();
            foreach ((string material, string poItem, decimal qty) in parsed)
            {
                GoodsReceiptItem? match = items.FirstOrDefault(item =>
                    !used.Contains(item.Id)
                    && string.Equals(item.MaterialCode?.Trim(), material, StringComparison.OrdinalIgnoreCase)
                    && Math.Max(0, item.AcceptedQty - item.ReversedQty) + TOLERANCE >= qty);
                if (match == null)
                {
                    match = items.FirstOrDefault(item =>
                        !used.Contains(item.Id)
                        && string.Equals(item.MaterialCode?.Trim(), material, StringComparison.OrdinalIgnoreCase));
                }

                if (match == null)
                {
                    throw new BadRequestCustomException(
                        "GRN_LINE_NOT_FOUND",
                        "Could not match SAP reversal line material " + material + " / " + poItem + " for local finalization.");
                }

                used.Add(match.Id);
                selected.Add((match, qty));
            }

            return selected;
        }

        private async Task ApplyLocalReversalAsync(
            BuyerBusinessProfile buyer,
            GoodsReceipt receipt,
            Guid userId,
            List<(GoodsReceiptItem Item, decimal Qty)> selected,
            CancellationToken cancellationToken)
        {
            Record(buyer.Id, receipt.Id, userId, EVENT_LOCAL_INVENTORY,
                "Reversing local stock after FIVE S4-GRN REVERSAL success");

            List<Guid> poItemIds = selected.Select(x => x.Item.PurchaseOrderItemId).Distinct().ToList();
            Dictionary<Guid, PurchaseOrderItem> poItems = await _repository.PurchaseOrderItem
                .FindByCondition(x => poItemIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            PurchaseOrder? purchaseOrder = await _repository.PurchaseOrder
                .FindByCondition(x => x.Id == receipt.PurchaseOrderId)
                .FirstOrDefaultAsync(cancellationToken);

            List<Guid> materialIds = selected.Where(x => x.Item.MaterialId != null).Select(x => x.Item.MaterialId!.Value).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = await _repository.ItemBuyerMaster
                .FindByCondition(x => materialIds.Contains(x.Id) && x.IsActive)
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                _repository, materials.Keys, cancellationToken);

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, userId);
            int itemIndex = 1;
            foreach ((GoodsReceiptItem item, decimal qty) in selected)
            {
                item.MaterialDocumentItem ??= itemIndex.ToString("0000", CultureInfo.InvariantCulture);
                itemIndex++;
                if (qty <= TOLERANCE)
                {
                    continue;
                }

                decimal remaining = Math.Max(0, item.AcceptedQty - item.ReversedQty);
                decimal apply = Math.Min(qty, remaining);
                if (apply <= TOLERANCE)
                {
                    _repository.GoodsReceiptItem.Update(item);
                    continue;
                }

                if (item.MaterialId != null && materials.TryGetValue(item.MaterialId.Value, out ItemBuyerMaster? material)
                    && SilaMaterialRules.HoldsStock(material))
                {
                    decimal baseQuantity = UomConverter.ToBase(_logger, material, apply, item.Uom, conversions);
                    await ledger.PostAsync(new InventoryMovement
                    {
                        LocationId = receipt.LocationId,
                        Material = material,
                        Direction = Common.SILA_DIRECTION_OUT,
                        TransactionType = Common.SILA_TXN_GOODS_RECEIPT_REVERSAL,
                        BaseQuantity = baseQuantity,
                        EnteredQuantity = apply,
                        EnteredUom = item.Uom,
                        ReferenceType = Common.SILA_REF_GRN_REVERSAL,
                        ReferenceId = receipt.Id,
                        ReferenceNumber = receipt.GrnNumber,
                        Reason = receipt.ReversalReason ?? "GRN reversal 102"
                    }, cancellationToken);
                }

                if (poItems.TryGetValue(item.PurchaseOrderItemId, out PurchaseOrderItem? poItem))
                {
                    poItem.ReceivedQuantity = Math.Max(0, poItem.ReceivedQuantity - apply);
                    _repository.PurchaseOrderItem.Update(poItem);
                }

                item.ReversedQty = Math.Min(item.AcceptedQty, item.ReversedQty + apply);
                _repository.GoodsReceiptItem.Update(item);
            }

            if (purchaseOrder != null)
            {
                List<PurchaseOrderItem> allLines = await _repository.PurchaseOrderItem
                    .FindByCondition(x => x.PurchaseOrderId == purchaseOrder.Id)
                    .ToListAsync(cancellationToken);
                if (allLines.All(x => x.ReceivedQuantity <= TOLERANCE))
                {
                    purchaseOrder.Status = "OPEN";
                }
                else if (allLines.All(x => SilaReceivingRules.OpenQuantity(x) <= TOLERANCE))
                {
                    purchaseOrder.Status = Common.SILA_PO_RECEIVED;
                }
                else
                {
                    purchaseOrder.Status = Common.SILA_PO_PARTIALLY_RECEIVED;
                }

                _repository.PurchaseOrder.Update(purchaseOrder);
            }

            ledger.AddEvent(Common.SILA_REF_GRN_REVERSAL, receipt.Id, EVENT_LOCAL_INVENTORY, receipt.ReversalReason);
        }

        private async Task InvalidateOpenInvoiceAsync(Invoice? invoice, CancellationToken cancellationToken)
        {
            if (invoice == null)
            {
                return;
            }

            string gate = SilaReceivingReversal.InvoiceGate(invoice.Status);
            if (gate is "INVOICE_READY" or "INVOICE_DRAFT" or "INVOICE_POSTING_FAILED")
            {
                invoice.Status = Common.SILA_INVOICE_REVIEWED;
                _repository.Invoice.Update(invoice);
            }

            await Task.CompletedTask;
        }

        private void Record(Guid buyerId, Guid grnId, Guid userId, string action, string? comment)
        {
            _repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = buyerId,
                ReferenceType = Common.SILA_REF_GRN_REVERSAL,
                ReferenceId = grnId,
                Action = action,
                Comment = comment != null && comment.Length > 1000 ? comment[..1000] : comment,
                ActorUserId = userId,
                IsActive = true
            });
        }

        private static SilaReceivingGrnReversalResultDto Result(GoodsReceipt receipt, string message)
        {
            return new SilaReceivingGrnReversalResultDto
            {
                GoodsReceiptId = receipt.Id,
                GrnNumber = receipt.GrnNumber,
                Status = receipt.Status,
                ReversalStatus = receipt.ReversalStatus,
                MaterialDocument = receipt.MaterialDocument,
                MaterialDocumentYear = receipt.MaterialDocumentYear,
                ReversalMaterialDocument = receipt.ReversalMaterialDocument,
                ReversalMaterialDocumentYear = receipt.ReversalMaterialDocumentYear,
                Message = message
            };
        }
    }
}

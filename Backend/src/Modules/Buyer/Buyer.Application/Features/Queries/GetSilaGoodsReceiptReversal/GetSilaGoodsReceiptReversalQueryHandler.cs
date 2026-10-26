using System.Globalization;
using Buyer.Application.Features.Shared;
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

namespace Buyer.Application.Features.Queries.GetSilaGoodsReceiptReversal
{
    public class GetSilaGoodsReceiptReversalQueryHandler : IRequestHandler<GetSilaGoodsReceiptReversalQuery, SilaReceivingGrnReversalPreviewDto>
    {
        private const decimal TOLERANCE = 0.0001m;
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaGoodsReceiptReversalQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaReceivingGrnReversalPreviewDto> Handle(GetSilaGoodsReceiptReversalQuery request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            GoodsReceipt? receipt = await _repository.GoodsReceipt
                .FindByCondition(x => x.Id == request.GoodsReceiptId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (receipt == null)
            {
                throw new NotFoundCustomException(
                    "GRN_NOT_FOUND",
                    "Goods Receipt " + request.GoodsReceiptId.ToString("D") + " could not be found for this organization.");
            }

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
            string? invoiceLoadError = null;
            if (receipt.InvoiceId != null)
            {
                try
                {
                    invoice = await _repository.Invoice
                        .FindByCondition(x => x.Id == receipt.InvoiceId && x.BuyerId == buyer.Id && x.IsActive)
                        .FirstOrDefaultAsync(cancellationToken);
                    if (invoice == null)
                    {
                        invoiceLoadError = "Invoice " + receipt.InvoiceId.Value.ToString("D") + " is linked but was not found.";
                    }
                }
                catch (Exception exception) when (exception is not OperationCanceledException and not BaseCustomException)
                {
                    _logger.LogError($"GRN invoice dependency load failed. GoodsReceiptId: {receipt.Id}, InvoiceId: {receipt.InvoiceId}, Error: {SilaLogText.Short(exception.Message)}");
                    invoiceLoadError = "Invoice dependency could not be loaded: " + SilaLogText.Short(exception.Message);
                }
            }

            InventoryErpPosting? invoicePosting = invoice?.ErpPostingId == null
                ? null
                : await _repository.InventoryErpPosting
                    .FindByCondition(x => x.Id == invoice.ErpPostingId.Value)
                    .FirstOrDefaultAsync(cancellationToken);
            string invoiceGate = invoiceLoadError != null
                ? "GRN_INVOICE_DEPENDENCY_LOAD_FAILED"
                : SilaReceivingReversal.ResolveInvoiceGate(invoice?.Status, invoicePosting);
            bool invoiceBlocks = SilaReceivingReversal.InvoiceBlocksGrn(invoiceGate);
            bool grnEligible = SilaReceivingReversal.IsReversalEligibleStatus(receipt.Status);
            bool alreadyFullyReversed = string.Equals(receipt.Status, Common.SILA_GRN_REVERSED, StringComparison.OrdinalIgnoreCase);
            bool needsLocal = SilaReceivingReversal.NeedsLocalFinalization(
                receipt.Status, receipt.ReversalStatus, receipt.ReversalMaterialDocument);

            string processType = IntegrationProcessType.POST_GRN_REVERSAL.ToString();
            List<ApiIntegrationConfiguration> reversalApis = await _repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.ProcessType == processType)
                .ToListAsync(cancellationToken);
            ApiIntegrationConfiguration? reversalApi = reversalApis.FirstOrDefault(x => SilaGrnSap.IsReversalConfiguredName(x.Name));
            bool apiConfigured = reversalApi != null;

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
                .FirstOrDefaultAsync(cancellationToken);

            InventoryErpPosting? originalPosting = receipt.ErpPostingId == null
                ? null
                : await _repository.InventoryErpPosting
                    .FindByCondition(x => x.Id == receipt.ErpPostingId.Value)
                    .FirstOrDefaultAsync(cancellationToken);
            List<SilaGrnPostedSapLine> postedLines = SilaGrnSap.ReadPostedGrnItems(originalPosting?.ErpRequestPayload);
            string? plant = !string.IsNullOrWhiteSpace(postedLines.FirstOrDefault()?.Plant)
                ? postedLines[0].Plant
                : !string.IsNullOrWhiteSpace(purchaseOrder?.PlantCode)
                    ? purchaseOrder!.PlantCode!.Trim()
                    : string.IsNullOrWhiteSpace(purchaseOrder?.CompanyCode) ? null : purchaseOrder!.CompanyCode!.Trim();
            string? storageLocation = postedLines.Select(x => x.StorageLocation).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))
                ?? location?.StorageLocationCode?.Trim();

            List<GoodsReceiptItem> items = await _repository.GoodsReceiptItem
                .FindByCondition(x => x.GoodsReceiptId == receipt.Id && x.IsActive && x.AcceptedQty > TOLERANCE)
                .OrderBy(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            List<Guid> poItemIds = items.Select(x => x.PurchaseOrderItemId).Distinct().ToList();
            List<PurchaseOrderItem> poItems = poItemIds.Count == 0
                ? new List<PurchaseOrderItem>()
                : await _repository.PurchaseOrderItem
                    .FindByCondition(x => poItemIds.Contains(x.Id))
                    .ToListAsync(cancellationToken);
            Dictionary<Guid, int> lineNumbers = poItems
                .GroupBy(x => x.Id)
                .ToDictionary(g => g.Key, g => g.First().LineNumber);

            decimal totalRemaining = 0;
            List<SilaReceivingGrnReversalLineDto> lines = new List<SilaReceivingGrnReversalLineDto>();
            int itemIndex = 1;
            foreach (GoodsReceiptItem item in items)
            {
                decimal remaining = Math.Max(0, item.AcceptedQty - item.ReversedQty);
                totalRemaining += remaining;
                int lineNumber = lineNumbers.TryGetValue(item.PurchaseOrderItemId, out int ln) ? ln : 0;
                SilaGrnPostedSapLine? posted = lineNumber > 0
                    ? SilaGrnSap.FindPostedLine(postedLines, item.MaterialCode ?? string.Empty, SilaGrnSap.FormatPurchaseOrderItem(lineNumber))
                    : null;
                string? linePlant = !string.IsNullOrWhiteSpace(posted?.Plant) ? posted!.Plant : plant;
                string? lineSloc = posted != null ? posted.StorageLocation : storageLocation;
                lines.Add(new SilaReceivingGrnReversalLineDto
                {
                    GoodsReceiptItemId = item.Id,
                    MaterialCode = item.MaterialCode,
                    MaterialName = item.MaterialName,
                    PoItem = lineNumber,
                    PurchaseOrderItem = lineNumber > 0 ? SilaGrnSap.FormatPurchaseOrderItem(lineNumber) : null,
                    MaterialDocumentItem = item.MaterialDocumentItem ?? itemIndex.ToString("0000", CultureInfo.InvariantCulture),
                    OriginalReceivedQty = item.AcceptedQty,
                    PreviouslyReversedQty = item.ReversedQty,
                    RemainingReversibleQty = remaining,
                    ReversalQty = remaining,
                    Uom = item.Uom,
                    Plant = linePlant,
                    StorageLocation = lineSloc
                });
                itemIndex++;
            }

            bool hasRemaining = totalRemaining > TOLERANCE;
            string decision = SilaReceivingReversal.Decide(
                grnEligible,
                invoiceBlocks,
                apiConfigured,
                alreadyFullyReversed,
                receipt.ReversalStatus,
                !string.IsNullOrWhiteSpace(receipt.MaterialDocument),
                needsLocal,
                hasRemaining);

            List<SilaReceivingGrnListItemDto> headers = await SilaReceivingRules.ToGrnListAsync(
                _repository, new List<GoodsReceipt> { receipt }, cancellationToken);
            if (headers.Count == 0)
            {
                throw new InternalServerCustomException(
                    "GRN_HEADER_MAP_FAILED",
                    "Goods Receipt " + receipt.GrnNumber + " was found but its reversal header could not be prepared.");
            }

            SilaReceivingGrnListItemDto header = headers[0];

            List<InventoryErpPosting> historyPostings = await _repository.InventoryErpPosting
                .FindByCondition(x => x.BuyerId == buyer.Id && x.ReferenceId == receipt.Id
                    && x.ReferenceType == Common.SILA_REF_GRN_REVERSAL && x.IsActive)
                .OrderByDescending(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            List<SilaReceivingGrnReversalHistoryDto> history = historyPostings.Select(posting =>
            {
                decimal qty = SilaGrnSap.ReadReversalQuantities(posting.ErpRequestPayload).Sum(x => x.Quantity);
                (string? md, string? year) = SilaGrnSap.ReadMaterialDocument(posting.ErpResponsePayload, posting.ErpReference);
                return new SilaReceivingGrnReversalHistoryDto
                {
                    ErpPostingId = posting.Id,
                    ReversalNumber = receipt.ReversalGrnNumber ?? posting.ReferenceNumber,
                    PostedOn = posting.PostedOn ?? posting.DateUpdated,
                    Status = posting.Status,
                    MaterialDocument = md,
                    MaterialDocumentYear = year,
                    Reason = null,
                    ReversedQuantity = qty,
                    ErrorMessage = posting.ErrorMessage
                };
            }).ToList();

            // Attach latest reversal reason from GRN header onto the newest history row when present.
            if (history.Count > 0 && !string.IsNullOrWhiteSpace(receipt.ReversalReason))
            {
                history[0].Reason = receipt.ReversalReason;
            }

            string? invoiceFirstMessage = invoiceGate == "INVOICE_REVERSAL_UNKNOWN"
                ? "Invoice posting outcome is unknown. Reconcile the invoice before reversing this goods receipt."
                : invoiceGate is "INVOICE_POSTED" or "INVOICE_POSTING"
                    ? SilaReceivingReversal.POSTED_INVOICE_MESSAGE
                    : "Invoice Status: " + (invoice?.Status ?? "POSTED") + ". GRN reversal requires Invoice reversal first.";
            string? message = invoiceLoadError ?? decision switch
            {
                SilaReceivingReversal.INVOICE_FIRST => invoiceFirstMessage,
                SilaReceivingReversal.ALREADY_REVERSED => "This goods receipt is fully reversed. No reversible quantity remains.",
                SilaReceivingReversal.UNKNOWN =>
                    "GRN_REVERSAL_POSTING_UNKNOWN. Reconcile with SAP before retrying. Do not reverse local inventory.",
                SilaReceivingReversal.IN_FLIGHT => "A GRN reversal is already processing.",
                SilaReceivingReversal.LOCAL_FINALIZE =>
                    "GRN_REVERSAL_LOCAL_FINALIZATION_FAILED. SAP 102 succeeded but local inventory finalization failed. Reprocess local finalization only. Do not call FIVE S4-GRN REVERSAL again.",
                SilaReceivingReversal.MISSING_MATERIAL_DOCUMENT =>
                    "GRN " + receipt.GrnNumber + " was found, but its SAP Material Document number is missing.",
                SilaReceivingReversal.NOT_CONFIGURED =>
                    "GRN_REVERSAL_INTEGRATION_NOT_CONFIGURED. Configure an ACTIVE integration named FIVE S4-GRN REVERSAL (API type POST_GRN_REVERSAL).",
                SilaReceivingReversal.NOT_POSTED =>
                    "GRN_NOT_POSTED. Only a posted or partially reversed goods receipt can be reversed. Current status: " + receipt.Status + ".",
                SilaReceivingReversal.READY =>
                    "Adjust Reversal Qty per line (default = remaining). POST REVERSAL calls FIVE S4-GRN REVERSAL with movement type 102.",
                _ => null
            };

            return new SilaReceivingGrnReversalPreviewDto
            {
                GoodsReceiptId = receipt.Id,
                GrnNumber = receipt.GrnNumber,
                Status = receipt.Status,
                MaterialDocument = receipt.MaterialDocument,
                MaterialDocumentYear = receipt.MaterialDocumentYear,
                ReversalMaterialDocument = receipt.ReversalMaterialDocument,
                ReversalMaterialDocumentYear = receipt.ReversalMaterialDocumentYear,
                ReversalGrnNumber = receipt.ReversalGrnNumber,
                ReversalGoodsReceiptId = receipt.ReversalGoodsReceiptId,
                ReversalStatus = receipt.ReversalStatus,
                PoNumber = receipt.PoNumber,
                SupplierName = header.SupplierName,
                CompanyCode = purchaseOrder?.CompanyCode,
                PropertyName = property?.PropertyName,
                Plant = plant,
                StorageLocation = storageLocation,
                OriginalPostingDate = receipt.DateCreated,
                InvoiceId = receipt.InvoiceId,
                InvoiceNumber = header.InvoiceNumber ?? invoice?.InvoiceNumber,
                InvoiceStatus = invoice?.Status,
                InvoiceGate = invoiceGate,
                Decision = decision,
                CanReverse = decision == SilaReceivingReversal.READY || decision == SilaReceivingReversal.LOCAL_FINALIZE,
                InvoiceMustReverseFirst = decision == SilaReceivingReversal.INVOICE_FIRST,
                LocalFinalizationNeeded = decision == SilaReceivingReversal.LOCAL_FINALIZE,
                FullDocumentCancelOnly = false,
                IntegrationName = reversalApi?.Name,
                Message = message,
                Lines = lines,
                History = history
            };
        }
    }
}

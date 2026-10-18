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

            // Invoice dependency must not abort the load — gate is returned on the preview.
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

            string invoiceGate = invoiceLoadError != null
                ? "GRN_INVOICE_DEPENDENCY_LOAD_FAILED"
                : SilaReceivingReversal.InvoiceGate(invoice?.Status);
            bool invoiceBlocks = SilaReceivingReversal.InvoiceBlocksGrn(invoiceGate);
            bool grnPosted = string.Equals(receipt.Status, Common.SILA_GRN_POSTED, StringComparison.OrdinalIgnoreCase);
            bool alreadyReversed = string.Equals(receipt.Status, Common.SILA_GRN_REVERSED, StringComparison.OrdinalIgnoreCase);
            bool needsLocal = SilaReceivingReversal.NeedsLocalFinalization(
                receipt.Status, receipt.ReversalStatus, receipt.ReversalMaterialDocument);

            // Load then filter in memory — IsConfiguredName / OrdinalIgnoreCase are not EF-translatable.
            string postGrn = IntegrationProcessType.POST_GRN.ToString();
            List<ApiIntegrationConfiguration> postGrnApis = await _repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.ProcessType == postGrn)
                .ToListAsync(cancellationToken);
            bool apiConfigured = postGrnApis.Any(x => SilaGrnSap.IsConfiguredName(x.Name)
                || (x.ResourcePath != null && x.ResourcePath.Contains("API_MATERIAL_DOCUMENT_SRV", StringComparison.OrdinalIgnoreCase)));

            string decision = SilaReceivingReversal.Decide(
                grnPosted,
                invoiceBlocks,
                apiConfigured,
                alreadyReversed,
                receipt.ReversalStatus,
                !string.IsNullOrWhiteSpace(receipt.MaterialDocument),
                needsLocal);

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

            List<SilaReceivingGrnListItemDto> headers = await SilaReceivingRules.ToGrnListAsync(
                _repository, new List<GoodsReceipt> { receipt }, cancellationToken);
            if (headers.Count == 0)
            {
                throw new InternalServerCustomException(
                    "GRN_HEADER_MAP_FAILED",
                    "Goods Receipt " + receipt.GrnNumber + " was found but its reversal header could not be prepared.");
            }

            SilaReceivingGrnListItemDto header = headers[0];

            List<SilaReceivingGrnReversalLineDto> lines = new List<SilaReceivingGrnReversalLineDto>();
            int itemIndex = 1;
            foreach (GoodsReceiptItem item in items)
            {
                decimal remaining = Math.Max(0, item.AcceptedQty - item.ReversedQty);
                lines.Add(new SilaReceivingGrnReversalLineDto
                {
                    GoodsReceiptItemId = item.Id,
                    MaterialCode = item.MaterialCode,
                    MaterialName = item.MaterialName,
                    PoItem = lineNumbers.TryGetValue(item.PurchaseOrderItemId, out int ln) ? ln : 0,
                    MaterialDocumentItem = item.MaterialDocumentItem ?? itemIndex.ToString("0000"),
                    OriginalReceivedQty = item.AcceptedQty,
                    PreviouslyReversedQty = item.ReversedQty,
                    RemainingReversibleQty = remaining,
                    ReversalQty = remaining,
                    Uom = item.Uom
                });
                itemIndex++;
            }

            string? message = invoiceLoadError ?? decision switch
            {
                SilaReceivingReversal.INVOICE_FIRST =>
                    "This Goods Receipt has already been invoiced. The SAP Supplier Invoice must be reversed before the Goods Receipt can be reversed.",
                SilaReceivingReversal.ALREADY_REVERSED => "This goods receipt is already reversed.",
                SilaReceivingReversal.UNKNOWN => "GRN reversal outcome is unknown. Reconcile with SAP before retrying.",
                SilaReceivingReversal.IN_FLIGHT => "A GRN reversal is already processing.",
                SilaReceivingReversal.LOCAL_FINALIZE =>
                    "SAP Cancel succeeded but local inventory finalization failed. Reprocess local finalization only. Do not Cancel again.",
                SilaReceivingReversal.MISSING_MATERIAL_DOCUMENT =>
                    "GRN " + receipt.GrnNumber + " was found, but its SAP Material Document number is missing.",
                SilaReceivingReversal.NOT_CONFIGURED => "No active FIVE S4 Material Document API is configured for Cancel.",
                SilaReceivingReversal.NOT_POSTED =>
                    "Only a posted goods receipt can be reversed. Current status: " + receipt.Status + ".",
                SilaReceivingReversal.READY => "SAP Cancel will reverse the full Material Document (movement type 102).",
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
                ReversalStatus = receipt.ReversalStatus,
                PoNumber = receipt.PoNumber,
                SupplierName = header.SupplierName,
                InvoiceId = receipt.InvoiceId,
                InvoiceNumber = header.InvoiceNumber ?? invoice?.InvoiceNumber,
                InvoiceStatus = invoice?.Status,
                InvoiceGate = invoiceGate,
                Decision = decision,
                CanReverse = decision == SilaReceivingReversal.READY || decision == SilaReceivingReversal.LOCAL_FINALIZE,
                InvoiceMustReverseFirst = decision == SilaReceivingReversal.INVOICE_FIRST,
                LocalFinalizationNeeded = decision == SilaReceivingReversal.LOCAL_FINALIZE,
                FullDocumentCancelOnly = true,
                Message = message,
                Lines = lines
            };
        }
    }
}

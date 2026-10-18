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
                ?? throw new NotFoundCustomException("Goods receipt not found.", "That goods receipt was not found.");

            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, receipt.LocationId, cancellationToken);

            EnsureMaterialDocument(receipt);
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
            bool alreadyReversed = string.Equals(receipt.Status, Common.SILA_GRN_REVERSED, StringComparison.OrdinalIgnoreCase);
            bool needsLocal = SilaReceivingReversal.NeedsLocalFinalization(
                receipt.Status, receipt.ReversalStatus, receipt.ReversalMaterialDocument);

            // SAP Cancel already confirmed: finish local inventory only (never Cancel again).
            if (input.LocalFinalizationOnly || needsLocal)
            {
                return await FinalizeLocalOnlyAsync(buyer, receipt, request.UserId, input.Reason, cancellationToken);
            }

            if (string.Equals(receipt.ReversalStatus, Common.SILA_POSTING_UNKNOWN, StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestCustomException(
                    "GRN reversal unknown.",
                    "GRN reversal outcome is unknown. Reconcile with SAP before retrying. Do not reverse local inventory.");
            }

            if (alreadyReversed)
            {
                return Result(receipt, "Goods receipt is already reversed.");
            }

            if (!string.Equals(receipt.Status, Common.SILA_GRN_POSTED, StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestCustomException("Not posted.", "Only a posted goods receipt can be reversed.");
            }

            Record(buyer.Id, receipt.Id, request.UserId, EVENT_REVERSAL_VALIDATION, $"InvoiceGate={invoiceGate}; MD={receipt.MaterialDocument}/{receipt.MaterialDocumentYear}");

            if (invoiceBlocks)
            {
                Record(buyer.Id, receipt.Id, request.UserId, EVENT_INVOICE_REVERSAL, $"Blocked: InvoiceGate={invoiceGate}");
                if (invoiceGate is "INVOICE_REVERSAL_FAILED" or "INVOICE_REVERSAL_UNKNOWN")
                {
                    throw new BadRequestCustomException(
                        "Invoice reversal blocked.",
                        invoiceGate == "INVOICE_REVERSAL_UNKNOWN"
                            ? "Invoice reversal outcome is unknown. Reconcile before reversing the Goods Receipt. GRN Cancel was not called."
                            : "Invoice reversal failed. Reprocess invoice reversal before reversing the Goods Receipt. GRN Cancel was not called.");
                }

                if (!input.ReverseInvoiceAndGrn)
                {
                    throw new BadRequestCustomException(
                        "Reverse invoice first.",
                        "This Goods Receipt has already been invoiced. The SAP Supplier Invoice must be reversed before the Goods Receipt can be reversed.");
                }

                // No REVERSE_INVOICE process type is configured in FIVE yet — do not call GRN Cancel.
                throw new BadRequestCustomException(
                    "Invoice reversal required.",
                    "Invoice reversal is not configured on this tenant. Reverse the SAP Supplier Invoice first, then reprocess GRN reversal. GRN Cancel was not called.");
            }

            if (string.IsNullOrWhiteSpace(receipt.MaterialDocument) || string.IsNullOrWhiteSpace(receipt.MaterialDocumentYear))
            {
                throw new BadRequestCustomException(
                    "Material Document missing.",
                    "Original SAP Material Document is not stored on this GRN. Cannot Cancel.");
            }

            // Idempotency: reuse in-flight / failed reversal posting when present.
            InventoryErpPosting? reversalPosting = null;
            if (receipt.ReversalErpPostingId != null)
            {
                reversalPosting = await _repository.InventoryErpPosting
                    .FindByCondition(x => x.Id == receipt.ReversalErpPostingId.Value)
                    .FirstOrDefaultAsync(cancellationToken);
                if (reversalPosting != null
                    && (reversalPosting.Status == Common.SILA_POSTING_POSTED || reversalPosting.Status == Common.SILA_POSTING_ERP_ACCEPTED)
                    && !string.IsNullOrWhiteSpace(reversalPosting.ErpReference))
                {
                    receipt.ReversalMaterialDocument ??= reversalPosting.ErpReference;
                    return await FinalizeLocalOnlyAsync(buyer, receipt, request.UserId, input.Reason, cancellationToken);
                }

                if (reversalPosting?.Status == Common.SILA_POSTING_UNKNOWN)
                {
                    throw new BadRequestCustomException(
                        "GRN reversal unknown.",
                        "A previous Cancel may have reached SAP. Reconcile before retrying.");
                }
            }

            IntegrationApiDto api = await _mediator.Send(new ResolveIntegrationQuery
            {
                OrganizationId = request.OrganizationId,
                ProcessType = IntegrationProcessType.POST_GRN,
                EntityCode = null
            }, cancellationToken);
            if (!api.Configured || api.ConfigurationId == null || api.ConfigurationId == Guid.Empty)
            {
                throw new BadRequestCustomException("API not configured.", "No active POST_GRN Material Document API is configured.");
            }

            if (!SilaGrnSap.IsConfiguredName(api.Name)
                && !(api.ResourcePath ?? string.Empty).Contains("API_MATERIAL_DOCUMENT_SRV", StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestCustomException(
                    "Wrong GRN API.",
                    "GRN Cancel requires FIVE S4 Material Document API (API_MATERIAL_DOCUMENT_SRV), not Z02 or Ariba.");
            }

            string cancelPath = SilaGrnSap.CancelResourcePathFrom(api.ResourcePath);
            string cancelBody = SilaGrnSap.CancelBody(receipt.MaterialDocument!, receipt.MaterialDocumentYear!, DateTime.UtcNow);

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

            Record(buyer.Id, receipt.Id, request.UserId, EVENT_GRN_REVERSAL, $"Calling Cancel {receipt.MaterialDocument}/{receipt.MaterialDocumentYear}");

            reversalPosting.Attempts++;
            reversalPosting.ErpRequestPayload = cancelBody.Length > 4000 ? cancelBody[..4000] : cancelBody;
            IntegrationSendResultDto send = await _mediator.Send(new SendIntegrationRequestCommand
            {
                OrganizationId = request.OrganizationId,
                ConfigurationId = api.ConfigurationId.Value,
                Body = cancelBody,
                ResourcePathOverride = cancelPath,
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
                reversalPosting.ErrorMessage = send.ErrorMessage ?? "Cancel outcome unknown.";
                receipt.ReversalStatus = Common.SILA_POSTING_UNKNOWN;
                _repository.InventoryErpPosting.Update(reversalPosting);
                _repository.GoodsReceipt.Update(receipt);
                await _repository.SaveAsync();
                throw new BadRequestCustomException(
                    "GRN reversal unknown.",
                    "Cancel may have reached SAP but the outcome is uncertain. Reconcile before retrying. Local inventory was not changed.");
            }

            if (!send.Answered || send.StatusCode < 200 || send.StatusCode >= 300)
            {
                reversalPosting.Status = Common.SILA_POSTING_FAILED;
                reversalPosting.ErrorMessage = send.ErrorMessage ?? $"HTTP {send.StatusCode}";
                receipt.ReversalStatus = Common.SILA_POSTING_FAILED;
                _repository.InventoryErpPosting.Update(reversalPosting);
                _repository.GoodsReceipt.Update(receipt);
                await _repository.SaveAsync();
                throw new BadRequestCustomException(
                    "GRN reversal failed.",
                    $"SAP Cancel failed. GRN remains POSTED. {(send.ErrorMessage ?? $"HTTP {send.StatusCode}")}");
            }

            (string? reversalMd, string? reversalYear) = SilaGrnSap.ReadMaterialDocument(send.ResponseBody, send.DocumentNumber);
            // Cancel often returns the reversal document number; fall back to DocumentNumber reader.
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
                await ApplyLocalReversalAsync(buyer, receipt, request.UserId, cancellationToken);
                reversalPosting.Status = Common.SILA_POSTING_POSTED;
                receipt.ReversalStatus = Common.SILA_POSTING_POSTED;
                receipt.Status = Common.SILA_GRN_REVERSED;
                receipt.ReversedOn = DateTime.UtcNow;
                _repository.InventoryErpPosting.Update(reversalPosting);
                _repository.GoodsReceipt.Update(receipt);
                await InvalidateOpenInvoiceAsync(invoice, cancellationToken);
                Record(buyer.Id, receipt.Id, request.UserId, EVENT_FINALIZATION, $"Reversed MD {receipt.ReversalMaterialDocument}");
                await _repository.SaveAsync();
                return Result(receipt, "Goods receipt reversed in SAP (102 via Cancel) and local inventory updated.");
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
                    "Local finalization failed.",
                    "SAP Cancel succeeded but local inventory finalization failed. Reprocess with local-finalization-only. Do not Cancel again.");
            }
        }

        private async Task<SilaReceivingGrnReversalResultDto> FinalizeLocalOnlyAsync(
            BuyerBusinessProfile buyer, GoodsReceipt receipt, Guid userId, string reason, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(receipt.ReversalMaterialDocument)
                && receipt.ReversalStatus != Common.SILA_POSTING_ERP_ACCEPTED
                && receipt.ReversalStatus != Common.SILA_POSTING_FAILED_LOCAL)
            {
                throw new BadRequestCustomException(
                    "Local finalization not allowed.",
                    "Local-only finalization requires a confirmed SAP Cancel success first.");
            }

            receipt.ReversalReason ??= reason.Trim();
            await ApplyLocalReversalAsync(buyer, receipt, userId, cancellationToken);
            if (receipt.ReversalErpPostingId != null)
            {
                InventoryErpPosting? posting = await _repository.InventoryErpPosting
                    .FindByCondition(x => x.Id == receipt.ReversalErpPostingId.Value)
                    .FirstOrDefaultAsync(cancellationToken);
                if (posting != null)
                {
                    posting.Status = Common.SILA_POSTING_POSTED;
                    posting.ErrorMessage = null;
                    _repository.InventoryErpPosting.Update(posting);
                }
            }

            receipt.ReversalStatus = Common.SILA_POSTING_POSTED;
            receipt.Status = Common.SILA_GRN_REVERSED;
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

        private async Task ApplyLocalReversalAsync(BuyerBusinessProfile buyer, GoodsReceipt receipt, Guid userId, CancellationToken cancellationToken)
        {
            Record(buyer.Id, receipt.Id, userId, EVENT_LOCAL_INVENTORY, "Reversing local stock after SAP Cancel success");
            List<GoodsReceiptItem> items = await _repository.GoodsReceiptItem
                .FindByCondition(x => x.GoodsReceiptId == receipt.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            List<Guid> poItemIds = items.Select(x => x.PurchaseOrderItemId).Distinct().ToList();
            Dictionary<Guid, PurchaseOrderItem> poItems = await _repository.PurchaseOrderItem
                .FindByCondition(x => poItemIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            PurchaseOrder? purchaseOrder = await _repository.PurchaseOrder
                .FindByCondition(x => x.Id == receipt.PurchaseOrderId)
                .FirstOrDefaultAsync(cancellationToken);

            List<Guid> materialIds = items.Where(x => x.MaterialId != null).Select(x => x.MaterialId!.Value).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = await _repository.ItemBuyerMaster
                .FindByCondition(x => materialIds.Contains(x.Id) && x.IsActive)
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                _repository, materials.Keys, cancellationToken);

            // Full-document Cancel: reverse remaining accepted quantity only once.
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, userId);
            int itemIndex = 1;
            foreach (GoodsReceiptItem item in items)
            {
                item.MaterialDocumentItem ??= itemIndex.ToString("0000");
                decimal remaining = Math.Max(0, item.AcceptedQty - item.ReversedQty);
                itemIndex++;
                if (remaining <= TOLERANCE)
                {
                    _repository.GoodsReceiptItem.Update(item);
                    continue;
                }

                if (item.MaterialId != null && materials.TryGetValue(item.MaterialId.Value, out ItemBuyerMaster? material)
                    && SilaMaterialRules.HoldsStock(material))
                {
                    decimal baseQuantity = UomConverter.ToBase(_logger, material, remaining, item.Uom, conversions);
                    await ledger.PostAsync(new InventoryMovement
                    {
                        LocationId = receipt.LocationId,
                        Material = material,
                        Direction = Common.SILA_DIRECTION_OUT,
                        TransactionType = Common.SILA_TXN_GOODS_RECEIPT_REVERSAL,
                        BaseQuantity = baseQuantity,
                        EnteredQuantity = remaining,
                        EnteredUom = item.Uom,
                        ReferenceType = Common.SILA_REF_GRN_REVERSAL,
                        ReferenceId = receipt.Id,
                        ReferenceNumber = receipt.GrnNumber,
                        Reason = receipt.ReversalReason ?? "GRN Cancel 102"
                    }, cancellationToken);
                }

                if (poItems.TryGetValue(item.PurchaseOrderItemId, out PurchaseOrderItem? poItem))
                {
                    poItem.ReceivedQuantity = Math.Max(0, poItem.ReceivedQuantity - remaining);
                    _repository.PurchaseOrderItem.Update(poItem);
                }

                item.ReversedQty = item.AcceptedQty;
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

        private static void EnsureMaterialDocument(GoodsReceipt receipt)
        {
            // No-op placeholder for clarity at call site.
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

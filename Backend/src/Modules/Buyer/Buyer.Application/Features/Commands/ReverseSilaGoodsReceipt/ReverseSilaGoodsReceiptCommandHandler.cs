using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ReverseSilaGoodsReceipt
{
    public class ReverseSilaGoodsReceiptCommandHandler : IRequestHandler<ReverseSilaGoodsReceiptCommand, string>
    {
        private const string EVENT_REVERSED = "REVERSED";
        private const decimal TOLERANCE = 0.0001m;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ReverseSilaGoodsReceiptCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<string> Handle(ReverseSilaGoodsReceiptCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(ReverseSilaGoodsReceiptCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<string> HandleOnceAsync(ReverseSilaGoodsReceiptCommand request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            GoodsReceipt receipt = await _repository.GoodsReceipt
                .FindByCondition(x => x.Id == request.GoodsReceiptId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundCustomException("Goods receipt not found.", "That goods receipt was not found.");

            if (!string.Equals(receipt.Status, Common.SILA_GRN_POSTED, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogError($"Goods receipt cannot be reversed. GoodsReceiptId: {receipt.Id}, Status: {receipt.Status}");
                throw new BadRequestCustomException("Not posted.", "Only a posted goods receipt can be reversed.");
            }

            bool invoicePostedToSap = false;
            Invoice? invoice = null;
            if (receipt.InvoiceId != null)
            {
                invoice = await _repository.Invoice
                    .FindByCondition(x => x.Id == receipt.InvoiceId && x.BuyerId == buyer.Id && x.IsActive)
                    .FirstOrDefaultAsync(cancellationToken);
                invoicePostedToSap = invoice != null && (
                    string.Equals(invoice.Status, Common.SILA_INVOICE_POSTED, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(invoice.Status, Common.SILA_INVOICE_AWAITING_PAYMENT, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(invoice.Status, Common.SILA_INVOICE_PAID, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(invoice.Status, Common.SILA_INVOICE_PARTIALLY_PAID, StringComparison.OrdinalIgnoreCase));
            }

            // Local reverse always runs; SAP reverse API is optional (NOT CONFIGURED still reverses SILA stock).
            string decision = SilaReceivingReversal.Decide(true, invoicePostedToSap, reversalConfigured: false);
            if (decision == SilaReceivingReversal.INVOICE_FIRST)
            {
                throw new BadRequestCustomException(
                    "Reverse the invoice first.",
                    "This goods receipt has a supplier invoice posted to SAP. Reverse that invoice before reversing the GRN.");
            }

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

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            foreach (GoodsReceiptItem item in items)
            {
                if (item.AcceptedQty <= TOLERANCE)
                {
                    continue;
                }

                if (item.MaterialId != null && materials.TryGetValue(item.MaterialId.Value, out ItemBuyerMaster? material)
                    && SilaMaterialRules.HoldsStock(material))
                {
                    decimal baseQuantity = UomConverter.ToBase(_logger, material, item.AcceptedQty, item.Uom, conversions);
                    await ledger.PostAsync(new InventoryMovement
                    {
                        LocationId = receipt.LocationId,
                        Material = material,
                        Direction = Common.SILA_DIRECTION_OUT,
                        TransactionType = Common.SILA_TXN_GOODS_RECEIPT_REVERSAL,
                        BaseQuantity = baseQuantity,
                        EnteredQuantity = item.AcceptedQty,
                        EnteredUom = item.Uom,
                        ReferenceType = Common.SILA_REF_GRN,
                        ReferenceId = receipt.Id,
                        ReferenceNumber = receipt.GrnNumber,
                        Reason = "GRN reversed"
                    }, cancellationToken);
                }

                if (poItems.TryGetValue(item.PurchaseOrderItemId, out PurchaseOrderItem? poItem))
                {
                    poItem.ReceivedQuantity = Math.Max(0, poItem.ReceivedQuantity - item.AcceptedQty);
                    _repository.PurchaseOrderItem.Update(poItem);
                }
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

            receipt.Status = Common.SILA_GRN_REVERSED;
            _repository.GoodsReceipt.Update(receipt);

            if (invoice != null
                && (invoice.Status == Common.SILA_INVOICE_READY
                    || invoice.Status == Common.SILA_INVOICE_GRN_POSTED
                    || invoice.Status == Common.SILA_INVOICE_GRN_IN_PROGRESS
                    || invoice.Status == Common.SILA_INVOICE_GRN_FAILED))
            {
                invoice.Status = Common.SILA_INVOICE_REVIEWED;
                _repository.Invoice.Update(invoice);
            }

            ledger.AddEvent(Common.SILA_REF_GRN, receipt.Id, EVENT_REVERSED, "Local GRN reversal");
            await _repository.SaveAsync();
            _logger.LogInfo($"Goods receipt reversed. GoodsReceiptId: {receipt.Id}, GrnNumber: {receipt.GrnNumber}");
            return decision == SilaReceivingReversal.NOT_CONFIGURED
                ? "Goods receipt reversed in SILA. Configure a GRN reversal API to reverse the SAP material document."
                : "Goods receipt reversed.";
        }
    }
}

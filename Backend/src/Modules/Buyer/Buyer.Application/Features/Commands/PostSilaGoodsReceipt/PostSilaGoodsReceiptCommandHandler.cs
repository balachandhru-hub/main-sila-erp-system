using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.PostSilaGoodsReceipt
{
    public class PostSilaGoodsReceiptCommandHandler : IRequestHandler<PostSilaGoodsReceiptCommand, Guid>
    {
        // Quantities are compared with this tolerance (4 decimals are stored).
        private const decimal TOLERANCE = 0.0001m;
        private const string EVENT_POSTED = "POSTED";

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public PostSilaGoodsReceiptCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Guid> Handle(PostSilaGoodsReceiptCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(PostSilaGoodsReceiptCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Guid> HandleOnceAsync(PostSilaGoodsReceiptCommand request, CancellationToken cancellationToken)
        {
            SilaReceivingGrnWriteDto input = request.Request;
            _logger.LogInfo($"Posting goods receipt. PurchaseOrderId: {input.PurchaseOrderId}, LocationId: {input.LocationId}, Lines: {input.Lines?.Count ?? 0}, UserId: {request.UserId}");

            List<SilaReceivingGrnLineWriteDto> lines = (input.Lines ?? new List<SilaReceivingGrnLineWriteDto>())
                .Where(x => x.ReceivedQty != 0 || x.AcceptedQty != 0 || x.RejectedQty != 0 || x.DamagedQty != 0)
                .ToList();
            ValidateLines(lines);
            SilaInputRules.MaxLength(_logger, input.DeliveryNote, SilaInputRules.CODE_LENGTH * 2, "delivery note");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PurchaseOrder purchaseOrder = await SilaReceivingRules.GetPurchaseOrderAsync(_repository, _logger, buyer.Id, input.PurchaseOrderId);
            if (SilaReceivingRules.IsClosed(purchaseOrder))
            {
                _logger.LogError($"Purchase order is closed. PurchaseOrderId: {purchaseOrder.Id}, Status: {purchaseOrder.Status}");
                throw new BadRequestCustomException("Purchase order is closed.", $"Purchase order {purchaseOrder.PoNumber} is {purchaseOrder.Status} and cannot be received.");
            }

            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, input.LocationId);
            if (location.LocationType != Common.SILA_LOCATION_STORE)
            {
                _logger.LogError($"Goods can be received only at a store. LocationId: {location.Id}, Type: {location.LocationType}");
                throw new BadRequestCustomException("Select a store.", "Goods are received at a store location, not at an outlet.");
            }

            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, location.Id, cancellationToken);

            List<PurchaseOrderItem> poItems = await _repository.PurchaseOrderItem
                .FindByCondition(x => x.PurchaseOrderId == purchaseOrder.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, PurchaseOrderItem> poItemsById = poItems.ToDictionary(x => x.Id);
            foreach (SilaReceivingGrnLineWriteDto line in lines)
            {
                if (!poItemsById.TryGetValue(line.PurchaseOrderItemId, out PurchaseOrderItem? poItem))
                {
                    _logger.LogError($"Purchase order line not found. PurchaseOrderItemId: {line.PurchaseOrderItemId}, PurchaseOrderId: {purchaseOrder.Id}");
                    throw new BadRequestCustomException("Purchase order line not found.", $"Every line must belong to purchase order {purchaseOrder.PoNumber}.");
                }

                decimal open = SilaReceivingRules.OpenQuantity(poItem);
                if (line.AcceptedQty > open + TOLERANCE)
                {
                    _logger.LogError($"Accepted quantity exceeds the open quantity. PurchaseOrderItemId: {poItem.Id}, Accepted: {line.AcceptedQty}, Open: {open}");
                    throw new BadRequestCustomException(
                        "Accepted quantity is too high.",
                        $"Line {poItem.LineNumber} ({poItem.ProductName}) has {open:0.####} open; accept at most that.");
                }
            }

            Invoice? invoice = await GetInvoiceAsync(input.InvoiceId, buyer.Id, purchaseOrder);
            if (SilaReceivingRules.IsServiceInvoice(invoice))
            {
                _logger.LogError($"Goods receipt for a service invoice. InvoiceId: {invoice!.Id}");
                throw new BadRequestCustomException(SilaReceivingRules.SERVICE_GRN_MESSAGE, "Post a service invoice without a goods receipt, or correct its invoice type.");
            }

            Dictionary<Guid, decimal> invoiceQuantities = invoice == null
                ? new Dictionary<Guid, decimal>()
                : await SilaReceivingRules.InvoiceQuantitiesAsync(_repository, invoice.Id, cancellationToken);
            Dictionary<string, ItemBuyerMaster> materials = await SilaReceivingRules.GetMaterialsByCodeAsync(
                _repository, buyer.Id, poItems.Select(x => x.MaterialCode), cancellationToken);
            foreach (SilaReceivingGrnLineWriteDto line in lines)
            {
                PurchaseOrderItem poItem = poItemsById[line.PurchaseOrderItemId];
                ItemBuyerMaster? lineMaterial = !string.IsNullOrWhiteSpace(poItem.MaterialCode) && materials.TryGetValue(poItem.MaterialCode.Trim(), out ItemBuyerMaster? m) ? m : null;
                string? problem = SilaReceivingRules.BatchExpiryProblem(line, poItem, lineMaterial, DateTime.UtcNow);
                if (problem != null)
                {
                    _logger.LogError($"Goods receipt batch or expiry is invalid. PurchaseOrderItemId: {poItem.Id}");
                    throw new BadRequestCustomException("Batch or expiry is missing or invalid.", problem);
                }
            }
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                _repository, materials.Values.Select(x => x.Id), cancellationToken);

            string grnNumber = await DocumentNumber.NextAsync(_repository, buyer.Id, DocumentNumber.GOODS_RECEIPT, 6, cancellationToken);
            GoodsReceipt receipt = new GoodsReceipt
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                GrnNumber = grnNumber,
                PurchaseOrderId = purchaseOrder.Id,
                PoNumber = purchaseOrder.PoNumber,
                LocationId = location.Id,
                InvoiceId = invoice?.Id,
                DeliveryNote = string.IsNullOrWhiteSpace(input.DeliveryNote) ? null : input.DeliveryNote.Trim(),
                Status = Common.SILA_GRN_POSTED,
                ReceivedBy = request.UserId,
                IsActive = true
            };
            _repository.GoodsReceipt.Create(receipt);

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            decimal totalAccepted = 0;
            foreach (SilaReceivingGrnLineWriteDto line in lines)
            {
                PurchaseOrderItem poItem = poItemsById[line.PurchaseOrderItemId];
                ItemBuyerMaster? material = !string.IsNullOrWhiteSpace(poItem.MaterialCode) && materials.TryGetValue(poItem.MaterialCode.Trim(), out ItemBuyerMaster? found)
                    ? found
                    : null;
                _repository.GoodsReceiptItem.Create(new GoodsReceiptItem
                {
                    Id = Guid.NewGuid(),
                    GoodsReceiptId = receipt.Id,
                    PurchaseOrderItemId = poItem.Id,
                    MaterialId = material?.Id,
                    MaterialCode = poItem.MaterialCode,
                    MaterialName = poItem.ProductName,
                    OrderedQty = poItem.Quantity,
                    ReceivedQty = line.ReceivedQty,
                    AcceptedQty = line.AcceptedQty,
                    RejectedQty = line.RejectedQty,
                    DamagedQty = line.DamagedQty,
                    Uom = poItem.UnitOfMeasure,
                    OpenQtyBefore = SilaReceivingRules.OpenQuantity(poItem),
                    InvoiceQty = invoiceQuantities.TryGetValue(poItem.Id, out decimal billed) ? billed : null,
                    BatchNumber = string.IsNullOrWhiteSpace(line.BatchNumber) ? null : line.BatchNumber.Trim(),
                    ExpiryDate = line.ExpiryDate?.Date,
                    IsActive = true
                });

                // Lines without an Item Master material are received on the purchase order but not stocked.
                if (material != null && line.AcceptedQty > 0)
                {
                    decimal baseQuantity = UomConverter.ToBase(_logger, material, line.AcceptedQty, poItem.UnitOfMeasure, conversions);
                    await ledger.PostAsync(new InventoryMovement
                    {
                        LocationId = location.Id,
                        Material = material,
                        Direction = Common.SILA_DIRECTION_IN,
                        TransactionType = Common.SILA_TXN_GOODS_RECEIPT,
                        BaseQuantity = baseQuantity,
                        EnteredQuantity = line.AcceptedQty,
                        EnteredUom = poItem.UnitOfMeasure,
                        UnitCost = poItem.UnitPrice != null && baseQuantity > 0 ? poItem.UnitPrice * line.AcceptedQty / baseQuantity : null,
                        ReferenceType = Common.SILA_REF_GRN,
                        ReferenceId = receipt.Id,
                        ReferenceNumber = receipt.GrnNumber
                    }, cancellationToken);
                }

                poItem.ReceivedQuantity += line.AcceptedQty;
                _repository.PurchaseOrderItem.Update(poItem);
                totalAccepted += line.AcceptedQty;
            }

            purchaseOrder.Status = poItems.All(x => SilaReceivingRules.OpenQuantity(x) <= TOLERANCE)
                ? Common.SILA_PO_RECEIVED
                : Common.SILA_PO_PARTIALLY_RECEIVED;

            // The ERP API is chosen by the purchase order's company code (else by the store's property, filled by the job).
            string? companyCode = string.IsNullOrWhiteSpace(purchaseOrder.CompanyCode) ? null : purchaseOrder.CompanyCode.Trim();
            if (totalAccepted > 0)
            {
                InventoryErpPosting posting = ledger.QueueErpPosting(Common.SILA_REF_GRN, receipt.Id, receipt.GrnNumber, location.Id, Common.SILA_MOVEMENT_GRN);
                posting.CompanyCode = companyCode;
                receipt.ErpPostingId = posting.Id;
            }

            if (invoice != null)
            {
                invoice.Status = Common.SILA_INVOICE_GRN_POSTED;
                invoice.PurchaseOrderId = purchaseOrder.Id;
                invoice.PoNumber = purchaseOrder.PoNumber;
                invoice.SupplierId ??= purchaseOrder.SupplierId;
                invoice.SupplierName ??= purchaseOrder.SupplierName;

                // "Post the GRN and post the invoice at once": the invoice is queued for POST_INVOICE once; the job sends it
                // after its goods receipts have reached the ERP.
                if (invoice.ErpPostingId == null && totalAccepted > 0)
                {
                    InventoryErpPosting invoicePosting = ledger.QueueErpPosting(
                        Common.SILA_REF_INVOICE, invoice.Id, invoice.InvoiceNumber ?? invoice.FileName, location.Id, Common.SILA_MOVEMENT_INVOICE);
                    invoicePosting.CompanyCode = companyCode;
                    invoice.ErpPostingId = invoicePosting.Id;
                }
            }

            ledger.AddEvent(Common.SILA_REF_GRN, receipt.Id, EVENT_POSTED, receipt.DeliveryNote);
            await _repository.SaveAsync();

            _logger.LogInfo($"Goods receipt posted. GoodsReceiptId: {receipt.Id}, GrnNumber: {receipt.GrnNumber}, PurchaseOrderStatus: {purchaseOrder.Status}");
            return receipt.Id;
        }

        private void ValidateLines(List<SilaReceivingGrnLineWriteDto> lines)
        {
            if (lines.Count == 0)
            {
                _logger.LogError("Goods receipt has no received quantity.");
                throw new BadRequestCustomException("Nothing to receive.", "Enter the received quantity of at least one line.");
            }

            if (lines.GroupBy(x => x.PurchaseOrderItemId).Any(x => x.Count() > 1))
            {
                _logger.LogError("A purchase order line is received twice in one goods receipt.");
                throw new BadRequestCustomException("Duplicate line.", "Each purchase order line can appear only once in a goods receipt.");
            }

            foreach (SilaReceivingGrnLineWriteDto line in lines)
            {
                if (line.ReceivedQty < 0 || line.AcceptedQty < 0 || line.RejectedQty < 0 || line.DamagedQty < 0)
                {
                    _logger.LogError($"Negative goods receipt quantity. PurchaseOrderItemId: {line.PurchaseOrderItemId}");
                    throw new BadRequestCustomException("Invalid quantity.", "Quantities cannot be negative.");
                }

                SilaInputRules.NonNegativeQuantity(_logger, line.ReceivedQty, "received quantity");

                if (Math.Abs(line.AcceptedQty + line.RejectedQty + line.DamagedQty - line.ReceivedQty) > TOLERANCE)
                {
                    _logger.LogError($"Goods receipt quantities do not add up. PurchaseOrderItemId: {line.PurchaseOrderItemId}");
                    throw new BadRequestCustomException("Quantities do not add up.", "Received must equal accepted + rejected + damaged on every line.");
                }
            }
        }

        // The invoice the goods came with, when given: it must belong to the buyer and to this purchase order.
        private async Task<Invoice?> GetInvoiceAsync(Guid? invoiceId, Guid buyerId, PurchaseOrder purchaseOrder)
        {
            if (invoiceId == null || invoiceId == Guid.Empty)
            {
                return null;
            }

            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyerId, invoiceId.Value);
            if (invoice.PurchaseOrderId != null && invoice.PurchaseOrderId != purchaseOrder.Id)
            {
                _logger.LogError($"Invoice belongs to another purchase order. InvoiceId: {invoice.Id}, PurchaseOrderId: {invoice.PurchaseOrderId}");
                throw new BadRequestCustomException("Invoice is for another purchase order.", $"Invoice {invoice.InvoiceNumber} is linked to purchase order {invoice.PoNumber}.");
            }

            return invoice;
        }
    }
}

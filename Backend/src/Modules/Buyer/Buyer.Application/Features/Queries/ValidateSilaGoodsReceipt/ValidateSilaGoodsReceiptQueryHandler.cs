using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;

namespace Buyer.Application.Features.Queries.ValidateSilaGoodsReceipt
{
    /// <summary>
    /// The same checks as posting a goods receipt, collected instead of thrown, plus warnings (partial receipt, rejected or
    /// damaged goods, invoice quantity differences, lines that are not stocked). Location access is still enforced.
    /// </summary>
    public class ValidateSilaGoodsReceiptQueryHandler : IRequestHandler<ValidateSilaGoodsReceiptQuery, SilaReceivingGrnValidationDto>
    {
        private const decimal TOLERANCE = 0.0001m;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ValidateSilaGoodsReceiptQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaReceivingGrnValidationDto> Handle(ValidateSilaGoodsReceiptQuery request, CancellationToken cancellationToken)
        {
            SilaReceivingGrnWriteDto input = request.Request;
            _logger.LogInfo($"Validating goods receipt. PurchaseOrderId: {input.PurchaseOrderId}, LocationId: {input.LocationId}, Lines: {input.Lines?.Count ?? 0}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            SilaReceivingGrnValidationDto result = new SilaReceivingGrnValidationDto();

            PurchaseOrder? purchaseOrder = await _repository.PurchaseOrder
                .FindByCondition(x => x.Id == input.PurchaseOrderId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (purchaseOrder == null)
            {
                result.Errors.Add("Select a purchase order of this organization.");
                return Finish(result);
            }

            result.Currency = purchaseOrder.Currency;
            if (SilaReceivingRules.IsClosed(purchaseOrder))
            {
                result.Errors.Add($"Purchase order {purchaseOrder.PoNumber} is {purchaseOrder.Status} and cannot be received.");
            }

            await CheckLocationAsync(request, buyer.Id, result, cancellationToken);
            Dictionary<Guid, decimal> invoiceQuantities = await CheckInvoiceAsync(input.InvoiceId, buyer.Id, purchaseOrder, result, cancellationToken);

            List<PurchaseOrderItem> poItems = await _repository.PurchaseOrderItem
                .FindByCondition(x => x.PurchaseOrderId == purchaseOrder.Id && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToListAsync(cancellationToken);
            Dictionary<string, MaterialEntity> materials = await SilaReceivingRules.GetMaterialsByCodeAsync(
                _repository, buyer.Id, poItems.Select(x => x.MaterialCode), cancellationToken);
            List<SilaReceivingGrnLineWriteDto> lines = (input.Lines ?? new List<SilaReceivingGrnLineWriteDto>())
                .Where(x => x.ReceivedQty != 0 || x.AcceptedQty != 0 || x.RejectedQty != 0 || x.DamagedQty != 0)
                .ToList();
            if (lines.Count == 0)
            {
                result.Errors.Add("Enter the received quantity of at least one line.");
            }

            if (lines.GroupBy(x => x.PurchaseOrderItemId).Any(x => x.Count() > 1))
            {
                result.Errors.Add("Each purchase order line can appear only once in a goods receipt.");
            }

            bool priced = true;
            decimal totalValue = 0;
            foreach (SilaReceivingGrnLineWriteDto line in lines)
            {
                PurchaseOrderItem? poItem = poItems.FirstOrDefault(x => x.Id == line.PurchaseOrderItemId);
                if (poItem == null)
                {
                    result.Errors.Add($"A line does not belong to purchase order {purchaseOrder.PoNumber}.");
                    continue;
                }

                SilaReceivingGrnValidationLineDto checkedLine = CheckLine(line, poItem, materials, invoiceQuantities, result);
                MaterialEntity? lineMaterial = !string.IsNullOrWhiteSpace(poItem.MaterialCode) && materials.TryGetValue(poItem.MaterialCode.Trim(), out MaterialEntity? m) ? m : null;
                string? batchProblem = SilaReceivingRules.BatchExpiryProblem(line, poItem, lineMaterial, DateTime.UtcNow);
                if (batchProblem != null)
                {
                    Error(result, checkedLine, batchProblem);
                }

                result.Lines.Add(checkedLine);
                result.TotalReceived += line.ReceivedQty;
                result.TotalAccepted += line.AcceptedQty;
                priced &= poItem.UnitPrice != null;
                totalValue += checkedLine.Value ?? 0;
            }

            result.TotalValue = priced && result.Lines.Count > 0 ? totalValue : null;
            _logger.LogInfo($"Goods receipt validated. PurchaseOrderId: {purchaseOrder.Id}, Errors: {result.Errors.Count}, Warnings: {result.Warnings.Count}");
            return Finish(result);
        }

        private static SilaReceivingGrnValidationLineDto CheckLine(
            SilaReceivingGrnLineWriteDto line, PurchaseOrderItem poItem, Dictionary<string, MaterialEntity> materials,
            Dictionary<Guid, decimal> invoiceQuantities, SilaReceivingGrnValidationDto result)
        {
            decimal open = SilaReceivingRules.OpenQuantity(poItem);
            bool stocked = !string.IsNullOrWhiteSpace(poItem.MaterialCode) && materials.ContainsKey(poItem.MaterialCode.Trim());
            SilaReceivingGrnValidationLineDto checkedLine = new SilaReceivingGrnValidationLineDto
            {
                PurchaseOrderItemId = poItem.Id,
                LineNumber = poItem.LineNumber,
                ProductName = poItem.ProductName,
                Uom = poItem.UnitOfMeasure,
                OrderedQty = poItem.Quantity,
                OpenQty = open,
                ReceivedQty = line.ReceivedQty,
                AcceptedQty = line.AcceptedQty,
                RemainingQty = Math.Max(0, open - line.AcceptedQty),
                InvoiceQty = invoiceQuantities.TryGetValue(poItem.Id, out decimal invoiced) ? invoiced : null,
                Value = poItem.UnitPrice == null ? null : poItem.UnitPrice * line.AcceptedQty,
                Stocked = stocked
            };
            string label = $"Line {poItem.LineNumber} ({poItem.ProductName})";
            if (line.ReceivedQty < 0 || line.AcceptedQty < 0 || line.RejectedQty < 0 || line.DamagedQty < 0)
            {
                Error(result, checkedLine, $"{label}: quantities cannot be negative.");
            }
            else if (Math.Abs(line.AcceptedQty + line.RejectedQty + line.DamagedQty - line.ReceivedQty) > TOLERANCE)
            {
                Error(result, checkedLine, $"{label}: received must equal accepted + rejected + damaged.");
            }

            if (line.AcceptedQty > open + TOLERANCE)
            {
                Error(result, checkedLine, $"{label}: {open:0.####} open; accept at most that.");
            }
            else if (line.AcceptedQty + TOLERANCE < open && line.AcceptedQty >= 0)
            {
                Warn(result, checkedLine, $"{label}: partial receipt, {checkedLine.RemainingQty:0.####} stays open.");
            }

            if (line.RejectedQty > 0 || line.DamagedQty > 0)
            {
                Warn(result, checkedLine, $"{label}: {line.RejectedQty:0.####} rejected and {line.DamagedQty:0.####} damaged are not stocked.");
            }

            if (checkedLine.InvoiceQty != null && Math.Abs(checkedLine.InvoiceQty.Value - line.AcceptedQty) > TOLERANCE)
            {
                Warn(result, checkedLine, $"{label}: the invoice bills {checkedLine.InvoiceQty:0.####}, {line.AcceptedQty:0.####} is accepted.");
            }

            if (!stocked && line.AcceptedQty > 0)
            {
                Warn(result, checkedLine, $"{label}: no Item Master material has code {poItem.MaterialCode}; it is received on the purchase order but not stocked.");
            }

            return checkedLine;
        }

        private async Task CheckLocationAsync(ValidateSilaGoodsReceiptQuery request, Guid buyerId, SilaReceivingGrnValidationDto result, CancellationToken cancellationToken)
        {
            if (request.Request.LocationId == Guid.Empty)
            {
                result.Errors.Add("Select the store that receives the goods.");
                return;
            }

            InventoryLocation? location = await _repository.InventoryLocation
                .FindByCondition(x => x.Id == request.Request.LocationId && x.BuyerId == buyerId && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (location == null)
            {
                result.Errors.Add("Select a store of this organization.");
                return;
            }

            if (location.LocationType != Common.SILA_LOCATION_STORE)
            {
                result.Errors.Add("Goods are received at a store location, not at an outlet.");
                return;
            }

            // Access is enforced like the post itself (403 for a store the user does not work at).
            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyerId, request.UserId, request.RoleId, location.Id, cancellationToken);
        }

        // The quantities the invoice bills per purchase order line; checks the invoice belongs to this purchase order.
        private async Task<Dictionary<Guid, decimal>> CheckInvoiceAsync(Guid? invoiceId, Guid buyerId, PurchaseOrder purchaseOrder, SilaReceivingGrnValidationDto result, CancellationToken cancellationToken)
        {
            Dictionary<Guid, decimal> quantities = new Dictionary<Guid, decimal>();
            if (invoiceId == null || invoiceId == Guid.Empty)
            {
                return quantities;
            }

            Invoice? invoice = await _repository.Invoice
                .FindByCondition(x => x.Id == invoiceId.Value && x.BuyerId == buyerId && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (invoice == null)
            {
                result.Errors.Add("Select an invoice uploaded by this organization.");
                return quantities;
            }

            if (invoice.PurchaseOrderId != null && invoice.PurchaseOrderId != purchaseOrder.Id)
            {
                result.Errors.Add($"Invoice {invoice.InvoiceNumber} is linked to purchase order {invoice.PoNumber}.");
                return quantities;
            }

            if (SilaReceivingRules.IsServiceInvoice(invoice))
            {
                result.Errors.Add(SilaReceivingRules.SERVICE_GRN_MESSAGE);
                return quantities;
            }

            if (invoice.Status != Common.SILA_INVOICE_REVIEWED && invoice.Status != Common.SILA_INVOICE_GRN_POSTED)
            {
                result.Warnings.Add("The invoice has not been reviewed yet; check its fields before it is posted to the ERP.");
            }

            List<InvoiceItem> items = await _repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive && x.PurchaseOrderItemId != null && x.Quantity != null)
                .ToListAsync(cancellationToken);
            foreach (IGrouping<Guid, InvoiceItem> group in items.GroupBy(x => x.PurchaseOrderItemId!.Value))
            {
                quantities[group.Key] = group.Sum(x => x.Quantity!.Value);
            }

            return quantities;
        }

        private static void Error(SilaReceivingGrnValidationDto result, SilaReceivingGrnValidationLineDto line, string message)
        {
            result.Errors.Add(message);
            line.Messages.Add(message);
        }

        private static void Warn(SilaReceivingGrnValidationDto result, SilaReceivingGrnValidationLineDto line, string message)
        {
            result.Warnings.Add(message);
            line.Messages.Add(message);
        }

        private static SilaReceivingGrnValidationDto Finish(SilaReceivingGrnValidationDto result)
        {
            result.Valid = result.Errors.Count == 0;
            return result;
        }
    }
}

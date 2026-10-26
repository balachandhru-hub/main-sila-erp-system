using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.PrepareSilaCreateInvoice
{
    public class PrepareSilaCreateInvoiceCommandHandler : IRequestHandler<PrepareSilaCreateInvoiceCommand, SilaInvoiceDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public PrepareSilaCreateInvoiceCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaInvoiceDetailDto> Handle(PrepareSilaCreateInvoiceCommand request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice? invoice = await _repository.Invoice.FindFirstByConditionAsync(x => x.Id == request.InvoiceId && x.BuyerId == buyer.Id && x.IsActive);
            if (invoice == null)
            {
                throw new NotFoundCustomException("Invoice not found.", "Choose an invoice from Create Invoice.");
            }

            SilaCreateInvoiceRequestDto body = request.Request;
            bool nonPo = SilaInvoiceCreation.IsNonPo(body.CreationType ?? invoice.CreationType);
            invoice.CreationType = nonPo ? Common.SILA_INVOICE_CREATION_NON_PO : Common.SILA_INVOICE_CREATION_PO;
            invoice.CompanyCode = await SilaInvoiceCreation.ResolveCompanyCodeAsync(
                _repository, buyer.Id, body.PropertyId ?? invoice.PropertyId, body.CompanyCode ?? invoice.CompanyCode, cancellationToken)
                ?? throw new BadRequestCustomException("Company code is required.", "Select a property or company code.");
            invoice.PropertyId = body.PropertyId ?? invoice.PropertyId;
            invoice.SilaSupplierId = body.SilaSupplierId ?? invoice.SilaSupplierId;
            invoice.SupplierId = body.SupplierId ?? invoice.SupplierId;
            invoice.SupplierName = string.IsNullOrWhiteSpace(body.SupplierName) ? invoice.SupplierName : body.SupplierName.Trim();
            invoice.InvoiceNumber = string.IsNullOrWhiteSpace(body.InvoiceNumber) ? invoice.InvoiceNumber : body.InvoiceNumber.Trim();
            invoice.InvoiceDate = body.InvoiceDate?.Date ?? invoice.InvoiceDate ?? DateTime.UtcNow.Date;
            invoice.Currency = string.IsNullOrWhiteSpace(body.Currency) ? invoice.Currency : body.Currency.Trim();
            invoice.GrossAmount = body.GrossAmount ?? invoice.GrossAmount;
            invoice.NetAmount = body.NetAmount ?? invoice.NetAmount;
            invoice.TaxAmount = body.TaxAmount ?? invoice.TaxAmount;
            invoice.InvoiceType = nonPo ? "SERVICE" : "MATERIAL";
            invoice.UpdatedBy = request.UserId;
            invoice.DateUpdated = DateTime.UtcNow;

            List<InvoiceItem> existing = await _repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            foreach (InvoiceItem item in existing)
            {
                item.IsActive = false;
                item.UpdatedBy = request.UserId;
                item.DateUpdated = DateTime.UtcNow;
                _repository.InvoiceItem.Update(item);
            }

            List<InvoiceItem> created;
            if (nonPo)
            {
                invoice.PurchaseOrderId = null;
                invoice.PoNumber = null;
                created = CreateNonPoLines(invoice.Id, body.Lines, request.UserId);
            }
            else
            {
                created = await CreatePoLinesAsync(invoice, body, buyer.Id, request.UserId, cancellationToken);
            }

            foreach (InvoiceItem item in created)
            {
                _repository.InvoiceItem.Create(item);
            }

            if (invoice.GrossAmount == null)
            {
                invoice.GrossAmount = created.Sum(x => x.Amount ?? 0);
            }

            string? supplierCode = await SilaReceivingRules.ErpSupplierCodeAsync(
                _repository, null, invoice.SupplierId, invoice.SilaSupplierId, cancellationToken);
            DateTime? postingDate = body.PostingDate?.Date;
            DateTime? taxDate = body.TaxDeterminationDate?.Date ?? invoice.InvoiceDate;
            if (nonPo)
            {
                SilaInvoicePostingData.StoreNonPo(invoice, created, request.UserId, supplierCode, postingDate, taxDate);
            }
            else
            {
                await SilaInvoicePostingData.StoreFromLocalAsync(
                    _repository, invoice, created, request.UserId, supplierCode, cancellationToken, postingDate, taxDate);
            }

            invoice.Status = Common.SILA_INVOICE_READY;
            _repository.Invoice.Update(invoice);
            await _repository.SaveAsync();
            _logger.LogInfo($"Create Invoice prepared. InvoiceId: {invoice.Id}, CreationType: {invoice.CreationType}, Lines: {created.Count}");
            return await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
        }

        private static List<InvoiceItem> CreateNonPoLines(Guid invoiceId, List<SilaCreateInvoiceLineDto> lines, Guid userId)
        {
            if (lines.Count == 0)
            {
                throw new BadRequestCustomException("Non-PO lines are required.", "Add at least one expense line.");
            }

            List<InvoiceItem> created = new List<InvoiceItem>();
            int number = 0;
            foreach (SilaCreateInvoiceLineDto row in lines.OrderBy(x => x.LineNumber))
            {
                number++;
                if (string.IsNullOrWhiteSpace(row.GlAccount))
                {
                    throw new BadRequestCustomException("GL account is required.", "Each Non-PO line needs a GL account.");
                }

                if (string.IsNullOrWhiteSpace(row.TaxCode))
                {
                    throw new BadRequestCustomException("Tax code is required.", "Each Non-PO line needs a tax code.");
                }

                if (row.Amount == null || row.Amount <= 0)
                {
                    throw new BadRequestCustomException("Line amount is required.", "Each Non-PO line needs an amount.");
                }

                created.Add(new InvoiceItem
                {
                    Id = Guid.NewGuid(),
                    InvoiceId = invoiceId,
                    LineNumber = number,
                    Description = string.IsNullOrWhiteSpace(row.Description) ? row.GlAccount.Trim() : row.Description.Trim(),
                    Quantity = row.Quantity ?? 1,
                    UnitPrice = row.UnitPrice ?? row.Amount,
                    Amount = row.Amount,
                    Uom = Compact(row.Uom),
                    TaxCode = row.TaxCode.Trim(),
                    TaxRate = row.TaxRate,
                    GlAccount = row.GlAccount.Trim(),
                    CostCenter = Compact(row.CostCenter),
                    ProfitCenter = Compact(row.ProfitCenter),
                    InternalOrder = Compact(row.InternalOrder),
                    WbsElement = Compact(row.WbsElement),
                    BusinessArea = Compact(row.BusinessArea),
                    AssignmentReference = Compact(row.AssignmentReference),
                    DebitCreditCode = Compact(row.DebitCreditCode) ?? "S",
                    LineText = Compact(row.LineText) ?? Compact(row.Description),
                    MatchStatus = "UNMATCHED",
                    IsActive = true,
                    CreatedBy = userId,
                    UpdatedBy = userId,
                    DateCreated = DateTime.UtcNow,
                    DateUpdated = DateTime.UtcNow
                });
            }

            return created;
        }

        private async Task<List<InvoiceItem>> CreatePoLinesAsync(
            Invoice invoice,
            SilaCreateInvoiceRequestDto body,
            Guid buyerId,
            Guid userId,
            CancellationToken cancellationToken)
        {
            if (body.PurchaseOrderId == null)
            {
                throw new BadRequestCustomException("Purchase order is required.", "Select a purchase order.");
            }

            PurchaseOrder order = await _repository.PurchaseOrder.FindFirstByConditionAsync(
                x => x.Id == body.PurchaseOrderId && x.BuyerId == buyerId && x.IsActive)
                ?? throw new NotFoundCustomException("Purchase order not found.", "Select a purchase order from the list.");
            invoice.PurchaseOrderId = order.Id;
            invoice.PoNumber = order.PoNumber;
            invoice.Currency ??= order.Currency;
            if (!string.IsNullOrWhiteSpace(order.CompanyCode))
            {
                invoice.CompanyCode = order.CompanyCode;
            }

            List<SilaEligibleGoodsReceiptDto> eligible = await SilaInvoiceCreation.EligibleGoodsReceiptsAsync(
                _repository, buyerId, order.Id, cancellationToken);
            List<Guid> selected = body.GoodsReceiptIds.Distinct().ToList();
            if (selected.Count == 0)
            {
                throw new BadRequestCustomException("Goods receipt is required.", "Select at least one goods receipt.");
            }

            List<SilaEligibleGoodsReceiptDto> chosen = eligible.Where(x => selected.Contains(x.Id)).ToList();
            if (chosen.Count != selected.Count)
            {
                throw new BadRequestCustomException("A selected goods receipt is not eligible.", "Refresh the goods receipts and choose again.");
            }

            List<GoodsReceipt> allPoReceipts = await _repository.GoodsReceipt
                .FindByCondition(x => x.BuyerId == buyerId && x.PurchaseOrderId == order.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            foreach (GoodsReceipt receipt in allPoReceipts)
            {
                if (selected.Contains(receipt.Id))
                {
                    receipt.InvoiceId = invoice.Id;
                }
                else if (receipt.InvoiceId == invoice.Id)
                {
                    receipt.InvoiceId = null;
                }

                _repository.GoodsReceipt.Update(receipt);
            }

            if (body.Lines.Count > 0)
            {
                return body.Lines.OrderBy(x => x.LineNumber).Select((row, index) => new InvoiceItem
                {
                    Id = Guid.NewGuid(),
                    InvoiceId = invoice.Id,
                    LineNumber = index + 1,
                    Description = row.Description,
                    Quantity = row.Quantity,
                    UnitPrice = row.UnitPrice,
                    Amount = row.Amount,
                    PurchaseOrderItemId = row.PurchaseOrderItemId,
                    GoodsReceiptItemId = row.GoodsReceiptItemId,
                    Uom = row.Uom,
                    TaxCode = Compact(row.TaxCode),
                    MatchStatus = "MATCHED",
                    IsActive = true,
                    CreatedBy = userId,
                    UpdatedBy = userId,
                    DateCreated = DateTime.UtcNow,
                    DateUpdated = DateTime.UtcNow
                }).ToList();
            }

            List<InvoiceItem> fromGrn = SilaInvoiceCreation.LinesFromGoodsReceipts(chosen, userId);
            foreach (InvoiceItem item in fromGrn)
            {
                item.InvoiceId = invoice.Id;
            }

            return fromGrn;
        }

        private static string? Compact(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}

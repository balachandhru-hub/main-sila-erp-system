using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.LinkSilaInvoiceGoodsReceipts
{
    public class LinkSilaInvoiceGoodsReceiptsCommandHandler : IRequestHandler<LinkSilaInvoiceGoodsReceiptsCommand, SilaInvoiceDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public LinkSilaInvoiceGoodsReceiptsCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaInvoiceDetailDto> Handle(LinkSilaInvoiceGoodsReceiptsCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Linking goods receipts to invoice. InvoiceId: {request.InvoiceId}, OrganizationId: {request.OrganizationId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            if (Submitted(invoice.Status))
            {
                throw new BadRequestCustomException("Goods receipts cannot be changed.", "This invoice has already been submitted.");
            }

            if (invoice.PurchaseOrderId == null)
            {
                throw new BadRequestCustomException("Match a purchase order first.", "Goods receipts are chosen from the matched purchase order.");
            }

            List<Guid> ids = (request.Request?.GoodsReceiptIds ?? new List<Guid>()).Where(x => x != Guid.Empty).Distinct().ToList();
            List<GoodsReceipt> selected = ids.Count == 0
                ? new List<GoodsReceipt>()
                : await _repository.GoodsReceipt
                    .FindByCondition(x => ids.Contains(x.Id) && x.BuyerId == buyer.Id && x.IsActive)
                    .ToListAsync(cancellationToken);
            if (selected.Count != ids.Count)
            {
                throw new NotFoundCustomException("Goods receipt not found.", "Choose a goods receipt of this purchase order.");
            }

            if (selected.Any(x => x.PurchaseOrderId != invoice.PurchaseOrderId))
            {
                throw new BadRequestCustomException("Goods receipt is for another purchase order.", "Choose a goods receipt of the matched purchase order.");
            }

            List<Guid> otherIds = selected
                .Where(x => x.InvoiceId != null && x.InvoiceId != invoice.Id)
                .Select(x => x.InvoiceId!.Value)
                .Distinct()
                .ToList();
            List<Invoice> others = otherIds.Count == 0
                ? new List<Invoice>()
                : await _repository.Invoice.FindByCondition(x => otherIds.Contains(x.Id) && x.IsActive).ToListAsync(cancellationToken);
            GoodsReceipt? taken = selected.FirstOrDefault(receipt =>
            {
                Invoice? other = others.FirstOrDefault(x => x.Id == receipt.InvoiceId);
                return other != null && Submitted(other.Status);
            });
            if (taken != null)
            {
                throw new ConflictCustomException(
                    "Goods receipt is already on a submitted invoice.",
                    $"Goods receipt {taken.GrnNumber} is already on an invoice that was submitted.");
            }

            List<GoodsReceipt> current = await _repository.GoodsReceipt
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.BuyerId == buyer.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            foreach (GoodsReceipt receipt in current.Where(x => !ids.Contains(x.Id)))
            {
                receipt.InvoiceId = null;
                _repository.GoodsReceipt.Update(receipt);
            }

            foreach (GoodsReceipt receipt in selected)
            {
                receipt.InvoiceId = invoice.Id;
                _repository.GoodsReceipt.Update(receipt);
            }

            bool confirmed = await ConfirmedAsync(selected, cancellationToken);
            if (selected.Count > 0 && confirmed && CanAdvance(invoice.Status))
            {
                invoice.Status = Common.SILA_INVOICE_READY;
            }
            else if (selected.Count == 0 && invoice.Status is Common.SILA_INVOICE_READY or Common.SILA_INVOICE_GRN_POSTED or Common.SILA_INVOICE_GRN_IN_PROGRESS)
            {
                invoice.Status = Common.SILA_INVOICE_REVIEWED;
            }

            _repository.Invoice.Update(invoice);
            await _repository.SaveAsync();
            _logger.LogInfo($"Goods receipts linked. InvoiceId: {invoice.Id}, Count: {selected.Count}, Status: {invoice.Status}");
            return await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
        }

        private async Task<bool> ConfirmedAsync(List<GoodsReceipt> receipts, CancellationToken cancellationToken)
        {
            if (receipts.Count == 0 || receipts.Any(x => x.Status != Common.SILA_GRN_POSTED))
            {
                return false;
            }

            List<Guid> postingIds = receipts.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            if (postingIds.Count == 0)
            {
                return true;
            }

            List<InventoryErpPosting> postings = await _repository.InventoryErpPosting
                .FindByCondition(x => postingIds.Contains(x.Id))
                .ToListAsync(cancellationToken);
            return receipts.All(receipt =>
            {
                if (receipt.ErpPostingId == null)
                {
                    return true;
                }

                InventoryErpPosting? posting = postings.FirstOrDefault(x => x.Id == receipt.ErpPostingId);
                return posting != null && posting.Status is Common.SILA_POSTING_POSTED or Common.SILA_POSTING_ERP_ACCEPTED or Common.SILA_POSTING_FAILED_LOCAL;
            });
        }

        private static bool Submitted(string status)
        {
            return status is Common.SILA_INVOICE_POSTING
                or Common.SILA_INVOICE_POSTED
                or Common.SILA_INVOICE_PENDING_APPROVAL
                or Common.SILA_INVOICE_POSTING_UNKNOWN
                or Common.SILA_INVOICE_LOCAL_FAILED
                or Common.SILA_INVOICE_AWAITING_PAYMENT
                or Common.SILA_INVOICE_PARTIALLY_PAID
                or Common.SILA_INVOICE_PAID
                or Common.SILA_INVOICE_OVERDUE;
        }

        private static bool CanAdvance(string status)
        {
            return status is Common.SILA_INVOICE_UPLOADED
                or Common.SILA_INVOICE_EXTRACTED
                or Common.SILA_INVOICE_OCR_FAILED
                or Common.SILA_INVOICE_REVIEWED
                or Common.SILA_INVOICE_GRN_POSTED
                or Common.SILA_INVOICE_GRN_IN_PROGRESS
                or Common.SILA_INVOICE_GRN_FAILED
                or Common.SILA_INVOICE_GET_PO_FAILED
                or Common.SILA_INVOICE_VALIDATION_FAILED
                or Common.SILA_INVOICE_APPROVAL_REJECTED
                or Common.SILA_INVOICE_READY_TO_POST;
        }
    }
}

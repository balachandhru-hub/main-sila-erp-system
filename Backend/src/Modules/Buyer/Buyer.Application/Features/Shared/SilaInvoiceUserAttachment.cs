using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// User-added invoice file on Invoice.FilePath. OCR source is that same file. GRN PDFs and S/4 attachments stay.
    /// </summary>
    public static class SilaInvoiceUserAttachment
    {
        public const string REMOVED_PATH = "(removed)";

        public static bool CanRemove(Invoice invoice, InventoryErpPosting? posting)
        {
            if (string.IsNullOrWhiteSpace(invoice.FileName) || invoice.FilePath == REMOVED_PATH)
            {
                return false;
            }

            if (SilaInvoiceLifecycle.AlreadyPosted(invoice.Status, posting?.ErpReference))
            {
                return false;
            }

            return invoice.Status is not (
                Common.SILA_INVOICE_POSTING
                or Common.SILA_INVOICE_PENDING_APPROVAL
                or Common.SILA_INVOICE_READY_TO_POST
                or Common.SILA_INVOICE_POSTING_UNKNOWN);
        }

        public static void Remove(IRepositoryWrapper repository, Invoice invoice, InventoryErpPosting? posting, Guid userId)
        {
            if (!CanRemove(invoice, posting))
            {
                throw new BadRequestCustomException(
                    "Invoice attachment cannot be removed.",
                    "Posted invoice attachments are kept as evidence and cannot be removed.");
            }

            invoice.FileName = string.Empty;
            invoice.FilePath = REMOVED_PATH;
            invoice.ContentHash = null;
            invoice.UpdatedBy = userId;
            invoice.DateUpdated = DateTime.UtcNow;
            repository.Invoice.Update(invoice);
            repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = invoice.BuyerId,
                ReferenceType = Common.SILA_REF_INVOICE,
                ReferenceId = invoice.Id,
                Action = "INVOICE_ATTACHMENT_REMOVED",
                Comment = "User-added invoice attachment removed. The stored file association was cleared.",
                ActorUserId = userId,
                IsActive = true
            });
        }
    }
}

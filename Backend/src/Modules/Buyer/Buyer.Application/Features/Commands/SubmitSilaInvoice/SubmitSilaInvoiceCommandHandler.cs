using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SubmitSilaInvoice
{
    public class SubmitSilaInvoiceCommandHandler : IRequestHandler<SubmitSilaInvoiceCommand, SilaInvoiceDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IMediator _mediator;
        private readonly IIntegrationHttpExecutor _executor;

        public SubmitSilaInvoiceCommandHandler(
            IRepositoryWrapper repository, ILoggerManager logger, IMediator mediator, IIntegrationHttpExecutor executor)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
            _executor = executor;
        }

        public async Task<SilaInvoiceDetailDto> Handle(SubmitSilaInvoiceCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Submitting invoice. InvoiceId: {request.InvoiceId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            await GuardAsync(invoice, cancellationToken);

            SilaInvoiceDetailDto current = await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
            if (!current.CanSubmitInvoice)
            {
                throw NotReady(invoice.Status);
            }

            List<InvoiceItem> items = await _repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            PurchaseOrder? order = invoice.PurchaseOrderId == null
                ? null
                : await _repository.PurchaseOrder.FindFirstByConditionAsync(x => x.Id == invoice.PurchaseOrderId);
            bool service = SilaReceivingRules.IsServiceInvoice(invoice);
            bool grnPosted = current.GoodsReceipts.Count > 0 && current.GoodsReceipts.All(x =>
                x.ErpPostingId == null || x.ErpStatus is Common.SILA_POSTING_POSTED or Common.SILA_POSTING_ERP_ACCEPTED or Common.SILA_POSTING_FAILED_LOCAL);
            string? companyCode = invoice.CompanyCode ?? order?.CompanyCode;
            bool nonPo = SilaInvoiceCreation.IsNonPo(invoice.CreationType);
            List<string> missing = SilaInvoiceLifecycle.Missing(invoice, items, !service && !nonPo, grnPosted, companyCode);
            if (missing.Count > 0)
            {
                string message = SilaInvoiceLifecycle.MISSING + ". " + string.Join("; ", missing);
                invoice.Status = Common.SILA_INVOICE_VALIDATION_FAILED;
                SilaInvoicePosting.Block(_repository, invoice, request.UserId, message);
                _repository.Invoice.Update(invoice);
                await _repository.SaveAsync();
                throw new BadRequestCustomException("Invoice cannot be submitted.", message);
            }

            string? duplicate = await SilaInvoicePosting.DuplicateMessageAsync(_repository, invoice, companyCode, cancellationToken);
            if (duplicate != null)
            {
                _logger.LogError($"Duplicate supplier invoice. InvoiceId: {invoice.Id}");
                throw new ConflictCustomException("Invoice is already posted.", duplicate);
            }

            _repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = invoice.BuyerId,
                ReferenceType = Common.SILA_REF_INVOICE,
                ReferenceId = invoice.Id,
                Action = "INVOICE_SUBMITTED",
                Comment = "Submitted",
                ActorUserId = request.UserId,
                IsActive = true
            });

            bool approved = await SilaInvoicePosting.ApprovalCompleteAsync(_repository, invoice.Id, cancellationToken);
            if (!approved && await SilaInvoicePosting.ApprovalConfiguredAsync(_repository, invoice.BuyerId, cancellationToken))
            {
                List<int> versions = await _repository.SilaApprovalStep
                    .FindByCondition(x => x.ReferenceType == Common.SILA_REF_INVOICE && x.ReferenceId == invoice.Id && x.IsActive)
                    .Select(x => x.Version)
                    .ToListAsync(cancellationToken);
                GoodsReceipt? receipt = await _repository.GoodsReceipt
                    .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                    .OrderByDescending(x => x.DateCreated)
                    .FirstOrDefaultAsync(cancellationToken);
                InventoryLocation? location = receipt == null ? null : await _repository.InventoryLocation.FindFirstByConditionAsync(x => x.Id == receipt.LocationId);
                await SilaApprovals.StartAsync(
                    _repository, _logger, invoice.BuyerId, Common.SILA_APPROVAL_TYPE_INVOICE, Common.SILA_REF_INVOICE, invoice.Id,
                    versions.Count == 0 ? 1 : versions.Max() + 1,
                    new ApprovalScope { LocationId = receipt?.LocationId, PropertyId = location?.PropertyId ?? invoice.PropertyId, CompanyCode = companyCode },
                    cancellationToken);
                invoice.Status = Common.SILA_INVOICE_PENDING_APPROVAL;
                _repository.Invoice.Update(invoice);
                await _repository.SaveAsync();
                _logger.LogInfo($"Invoice waiting for approval. InvoiceId: {invoice.Id}");
                return await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
            }

            await PrepareMissingPostingDataAsync(invoice, items, request.UserId, cancellationToken);
            await SilaInvoicePosting.ContinueAsync(_repository, _logger, _mediator, _executor, buyer, invoice, request.UserId, cancellationToken);
            invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            _logger.LogInfo($"Invoice submission finished. InvoiceId: {invoice.Id}, Status: {invoice.Status}");
            return await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
        }

        /// <summary>
        /// PWA submit has no Refresh/GET PO step. Persist posting data from this invoice's
        /// current linked posted GRN before ContinueAsync. Does not resolve GRNs by PO.
        /// </summary>
        private async Task PrepareMissingPostingDataAsync(
            Invoice invoice, List<InvoiceItem> items, Guid userId, CancellationToken cancellationToken)
        {
            if (SilaInvoicePostingData.Read(invoice.PostingData) != null)
            {
                return;
            }

            List<GoodsReceipt> receipts = await _repository.GoodsReceipt
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.BuyerId == invoice.BuyerId && x.IsActive)
                .ToListAsync(cancellationToken);
            if (receipts.Count == 0 || receipts.Any(x => x.Status != Common.SILA_GRN_POSTED))
            {
                throw new BadRequestCustomException(
                    "Invoice is not ready to submit.",
                    "Submit the invoice after the goods receipt has been confirmed.");
            }

            if (!await SilaInvoiceGrnGate.AllGoodsReceiptsPostedAsync(_repository, invoice, cancellationToken))
            {
                throw new BadRequestCustomException(
                    "Invoice is not ready to submit.",
                    "Submit the invoice after the goods receipt has been confirmed.");
            }

            Guid? purchaseOrderSupplierId = invoice.PurchaseOrderId == null
                ? null
                : await _repository.PurchaseOrder
                    .FindByCondition(x => x.Id == invoice.PurchaseOrderId)
                    .Select(x => (Guid?)x.SupplierId)
                    .FirstOrDefaultAsync(cancellationToken);
            string? supplierCode = await SilaReceivingRules.ErpSupplierCodeAsync(
                _repository, purchaseOrderSupplierId, invoice.SupplierId, invoice.SilaSupplierId, cancellationToken);
            await SilaInvoicePostingData.StoreFromLocalAsync(
                _repository, invoice, items, userId, supplierCode, cancellationToken);
            _repository.Invoice.Update(invoice);
            await _repository.SaveAsync();
        }

        private async Task GuardAsync(Invoice invoice, CancellationToken cancellationToken)
        {
            if (invoice.ErpPostingId == null)
            {
                return;
            }

            InventoryErpPosting? posting = await _repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == invoice.ErpPostingId && x.BuyerId == invoice.BuyerId);
            if (posting == null)
            {
                return;
            }

            if (posting.Status == Common.SILA_POSTING_UNKNOWN)
            {
                throw new BadRequestCustomException(
                    "Reconcile this invoice.",
                    "SAP did not confirm whether the invoice was created. Reconcile it before anything is sent again.");
            }

            if (SilaTrackerRules.ErpAlreadyAccepted(posting) || posting.Status == Common.SILA_POSTING_POSTED)
            {
                throw new ConflictCustomException("Invoice is already posted.", "SAP already accepted this invoice. It will not be posted again.");
            }
        }

        private static Exception NotReady(string status)
        {
            if (status == Common.SILA_INVOICE_POSTING_UNKNOWN)
            {
                return new BadRequestCustomException("Reconcile this invoice.", "The posting result is unknown. SAP will not be called until it is reconciled.");
            }

            if (status == Common.SILA_INVOICE_LOCAL_FAILED)
            {
                return new BadRequestCustomException(
                    "SAP invoice was created successfully. SILA local finalization requires reprocessing.",
                    "Reprocessing will update SILA only. SAP will not be called again.");
            }

            if (status == Common.SILA_INVOICE_POSTING_FAILED || status == Common.SILA_INVOICE_POSTING)
            {
                return new BadRequestCustomException("Invoice posting failed.", "Edit the invoice and resubmit it. SAP is called again with the corrected document.");
            }

            return new BadRequestCustomException("Invoice is not ready to submit.", "Submit the invoice after the goods receipt has been confirmed.");
        }
    }
}

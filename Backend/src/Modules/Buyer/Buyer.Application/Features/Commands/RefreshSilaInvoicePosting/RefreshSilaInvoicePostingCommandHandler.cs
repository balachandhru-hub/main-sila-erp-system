using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.RefreshSilaInvoicePosting
{
    public class RefreshSilaInvoicePostingCommandHandler : IRequestHandler<RefreshSilaInvoicePostingCommand, SilaInvoiceDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIntegrationHttpExecutor _executor;

        public RefreshSilaInvoicePostingCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IIntegrationHttpExecutor executor)
        {
            _repository = repository;
            _logger = logger;
            _executor = executor;
        }

        public async Task<SilaInvoiceDetailDto> Handle(RefreshSilaInvoicePostingCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Refreshing invoice posting data. InvoiceId: {request.InvoiceId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            if (Locked(invoice.Status))
            {
                throw new BadRequestCustomException(
                    "Posting data cannot be refreshed.",
                    "Refresh from S/4 is not available while the invoice is posting, already posted, unknown, or waiting on local finalization.");
            }

            string? readError = await SilaInvoicePosting.RefreshPurchaseOrderAsync(
                _repository, _logger, _executor, buyer.OrganizationId, invoice, request.UserId, cancellationToken);
            if (readError != null)
            {
                invoice.Status = Common.SILA_INVOICE_GET_PO_FAILED;
                SilaInvoicePosting.Block(_repository, invoice, request.UserId, readError);
                _repository.Invoice.Update(invoice);
                await _repository.SaveAsync();
                throw new BadRequestCustomException("Purchase order could not be read.", readError);
            }

            SilaInvoicePostingData.Prepared? prepared = SilaInvoicePostingData.Read(invoice.PostingData);
            List<string> missing = SilaInvoicePostingData.Missing(prepared);
            if (invoice.Status != Common.SILA_INVOICE_POSTING_FAILED)
            {
                invoice.Status = missing.Count == 0 ? Common.SILA_INVOICE_READY_TO_POST : Common.SILA_INVOICE_VALIDATION_FAILED;
            }

            if (missing.Count > 0)
            {
                SilaInvoicePosting.Block(_repository, invoice, request.UserId, SilaInvoiceLifecycle.MISSING + ". " + string.Join("; ", missing));
            }

            _repository.Invoice.Update(invoice);
            await _repository.SaveAsync();
            _logger.LogInfo($"Invoice posting data refreshed. InvoiceId: {invoice.Id}, Status: {invoice.Status}, Version: {prepared?.Version}");
            return await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
        }

        private static bool Locked(string status)
        {
            return status is Common.SILA_INVOICE_POSTING
                or Common.SILA_INVOICE_POSTED
                or Common.SILA_INVOICE_POSTING_UNKNOWN
                or Common.SILA_INVOICE_LOCAL_FAILED
                or Common.SILA_INVOICE_AWAITING_PAYMENT
                or Common.SILA_INVOICE_PARTIALLY_PAID
                or Common.SILA_INVOICE_PAID
                or Common.SILA_INVOICE_OVERDUE;
        }
    }
}

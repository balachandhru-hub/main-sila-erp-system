using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.LookupSilaCreditMemoInvoice
{
    public class LookupSilaCreditMemoInvoiceQueryHandler : IRequestHandler<LookupSilaCreditMemoInvoiceQuery, List<SilaCreditMemoReferenceInvoiceDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public LookupSilaCreditMemoInvoiceQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaCreditMemoReferenceInvoiceDto>> Handle(LookupSilaCreditMemoInvoiceQuery request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            int limit = SilaInputRules.Limit(request.Limit, 20);
            Invoice? exact = await SilaCreditMemoRules.ResolveReferenceInvoiceAsync(
                _repository, buyer.Id, request.InvoiceId, request.InvoiceNumber, request.ErpInvoiceId, cancellationToken);
            List<Invoice> invoices = new List<Invoice>();
            if (exact != null)
            {
                invoices.Add(exact);
            }
            else if (!string.IsNullOrWhiteSpace(request.InvoiceNumber) || !string.IsNullOrWhiteSpace(request.ErpInvoiceId))
            {
                string search = (request.InvoiceNumber ?? request.ErpInvoiceId ?? string.Empty).Trim();
                List<Guid> erpIds = await _repository.InventoryErpPosting
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive
                        && x.ReferenceType == Buyer.Domain.Common.Common.SILA_REF_INVOICE
                        && x.ErpReference != null && x.ErpReference.Contains(search))
                    .Select(x => x.ReferenceId)
                    .Take(limit)
                    .ToListAsync(cancellationToken);
                invoices = await _repository.Invoice
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive
                        && ((x.InvoiceNumber != null && x.InvoiceNumber.Contains(search)) || erpIds.Contains(x.Id)))
                    .OrderByDescending(x => x.DateCreated)
                    .Take(limit)
                    .ToListAsync(cancellationToken);
            }

            List<SilaCreditMemoReferenceInvoiceDto> result = new List<SilaCreditMemoReferenceInvoiceDto>();
            foreach (Invoice invoice in invoices)
            {
                InventoryErpPosting? posting = invoice.ErpPostingId == null
                    ? null
                    : await _repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == invoice.ErpPostingId && x.BuyerId == buyer.Id);
                if (!SilaCreditMemoRules.InvoiceEligible(invoice, posting))
                {
                    continue;
                }

                result.Add(await SilaCreditMemoRules.ToReferenceAsync(_repository, invoice, cancellationToken));
            }

            return result;
        }
    }
}

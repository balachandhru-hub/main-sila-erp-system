using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaInvoice
{
    public class GetSilaInvoiceQueryHandler : IRequestHandler<GetSilaInvoiceQuery, SilaInvoiceDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaInvoiceQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaInvoiceDetailDto> Handle(GetSilaInvoiceQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching invoice. InvoiceId: {request.InvoiceId}, OrganizationId: {request.OrganizationId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            SilaInvoiceDetailDto result = await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
            _logger.LogInfo($"Invoice fetched. InvoiceId: {invoice.Id}, Status: {invoice.Status}");
            return result;
        }
    }
}

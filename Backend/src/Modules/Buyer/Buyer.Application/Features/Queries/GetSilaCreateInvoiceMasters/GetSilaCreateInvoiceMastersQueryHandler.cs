using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaCreateInvoiceMasters
{
    public class GetSilaCreateInvoiceMastersQueryHandler : IRequestHandler<GetSilaCreateInvoiceMastersQuery, SilaCreateInvoiceMastersDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaCreateInvoiceMastersQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaCreateInvoiceMastersDto> Handle(GetSilaCreateInvoiceMastersQuery request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            return await SilaInvoiceCreation.MastersAsync(_repository, buyer.Id, cancellationToken);
        }
    }
}

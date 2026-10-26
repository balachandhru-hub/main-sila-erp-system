using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaCreditMemoEligibleLines
{
    public class GetSilaCreditMemoEligibleLinesQueryHandler : IRequestHandler<GetSilaCreditMemoEligibleLinesQuery, List<SilaCreditMemoEligibleLineDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaCreditMemoEligibleLinesQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaCreditMemoEligibleLineDto>> Handle(GetSilaCreditMemoEligibleLinesQuery request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaCreditMemoRules.RequirePostedInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId, cancellationToken);
            return await SilaCreditMemoRules.EligibleLinesAsync(_repository, invoice, null, cancellationToken);
        }
    }
}

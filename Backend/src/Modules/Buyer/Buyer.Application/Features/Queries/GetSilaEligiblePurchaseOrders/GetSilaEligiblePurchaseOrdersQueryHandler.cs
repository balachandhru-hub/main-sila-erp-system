using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaEligiblePurchaseOrders
{
    public class GetSilaEligiblePurchaseOrdersQueryHandler : IRequestHandler<GetSilaEligiblePurchaseOrdersQuery, List<SilaEligiblePurchaseOrderDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaEligiblePurchaseOrdersQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaEligiblePurchaseOrderDto>> Handle(GetSilaEligiblePurchaseOrdersQuery request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            string? company = await SilaInvoiceCreation.ResolveCompanyCodeAsync(
                _repository, buyer.Id, request.PropertyId, request.CompanyCode, cancellationToken);
            return await SilaInvoiceCreation.EligiblePurchaseOrdersAsync(
                _repository, buyer.Id, request.SilaSupplierId, request.SupplierId, company, request.Search, cancellationToken);
        }
    }
}

using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaEligibleGoodsReceipts
{
    public class GetSilaEligibleGoodsReceiptsQueryHandler : IRequestHandler<GetSilaEligibleGoodsReceiptsQuery, List<SilaEligibleGoodsReceiptDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaEligibleGoodsReceiptsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaEligibleGoodsReceiptDto>> Handle(GetSilaEligibleGoodsReceiptsQuery request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            return await SilaInvoiceCreation.EligibleGoodsReceiptsAsync(_repository, buyer.Id, request.PurchaseOrderId, cancellationToken);
        }
    }
}

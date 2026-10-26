using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaCreditMemo
{
    public class GetSilaCreditMemoQueryHandler : IRequestHandler<GetSilaCreditMemoQuery, SilaCreditMemoDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaCreditMemoQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaCreditMemoDetailDto> Handle(GetSilaCreditMemoQuery request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            CreditMemo memo = await SilaCreditMemoRules.GetAsync(_repository, _logger, buyer.Id, request.CreditMemoId);
            return await SilaCreditMemoRules.ToDetailAsync(_repository, memo, cancellationToken);
        }
    }
}

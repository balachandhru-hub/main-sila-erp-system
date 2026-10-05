using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaQuickTransferPolicy
{
    /// <summary>The buyer's quick-transfer policy, or the defaults when none is saved.</summary>
    public class GetSilaQuickTransferPolicyQueryHandler : IRequestHandler<GetSilaQuickTransferPolicyQuery, SilaQuickTransferPolicyDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaQuickTransferPolicyQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaQuickTransferPolicyDto> Handle(GetSilaQuickTransferPolicyQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching quick-transfer policy. OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            QuickTransferPolicy policy = await SilaQuickTransferRules.GetPolicyAsync(_repository, buyer.Id, cancellationToken);

            _logger.LogInfo($"Quick-transfer policy fetched. BuyerId: {buyer.Id}, Enabled: {policy.Enabled}");
            return SilaQuickTransferRules.ToDto(policy);
        }
    }
}

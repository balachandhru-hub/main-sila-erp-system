using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPosPullOrganizations
{
    public class GetSilaPosPullOrganizationsQueryHandler : IRequestHandler<GetSilaPosPullOrganizationsQuery, List<Guid>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaPosPullOrganizationsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<Guid>> Handle(GetSilaPosPullOrganizationsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo("Fetching organizations with an active POS sales API.");
            List<Guid> organizationIds = await _repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.ProcessType == IntegrationProcessType.GET_POS_SALE
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.IsActive)
                .Select(x => x.OrganizationId)
                .Distinct()
                .ToListAsync(cancellationToken);
            List<Guid> buyers = await _repository.BuyerBusinessProfile
                .FindByCondition(x => organizationIds.Contains(x.OrganizationId) && x.IsActive)
                .Select(x => x.OrganizationId)
                .ToListAsync(cancellationToken);
            _logger.LogInfo($"Organizations with an active POS sales API fetched. Count: {buyers.Count}");
            return buyers;
        }
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;
using SharedKernel.LoggerServices;
using Buyer.Domain.Common;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Queries.GetDueIntegrations
{
    public class GetDueIntegrationsQueryHandler : IRequestHandler<GetDueIntegrationsQuery, List<DueIntegrationDto>>
    {
        private const int BATCH_SIZE = 10;
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetDueIntegrationsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<DueIntegrationDto>> Handle(GetDueIntegrationsQuery request, CancellationToken cancellationToken)
        {
            List<ApiIntegrationConfiguration> due = await _repository.ApiIntegrationConfiguration.ListDueAsync(
                DateTime.UtcNow, BATCH_SIZE, IntegrationProcessCatalog.PullableTypes(Common.INTEGRATION_SIDE), cancellationToken);
            if (due.Count > 0)
            {
                _logger.LogInfo($"Scheduled integrations are due. Count: {due.Count}");
            }

            // The scheduler works by organization: the owner of a Buyer-side configuration is a buyer profile.
            List<Guid> buyerIds = due.Select(item => item.BuyerId).Distinct().ToList();
            Dictionary<Guid, Guid> organizations = await _repository.BuyerBusinessProfile
                .FindByCondition(x => buyerIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.OrganizationId, cancellationToken);
            return due
                .Where(item => organizations.ContainsKey(item.BuyerId))
                .Select(item => new DueIntegrationDto { OrganizationId = organizations[item.BuyerId], ConfigurationId = item.Id })
                .ToList();
        }
    }
}

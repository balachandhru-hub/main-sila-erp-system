using MediatR;
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

            return due.Select(item => new DueIntegrationDto { OrganizationId = item.OrganizationId, ConfigurationId = item.Id }).ToList();
        }
    }
}

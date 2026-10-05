using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;
using Supplier.Infrastructure.Contracts.IRepository;

namespace Supplier.Application.Features.Queries.GetIntegrations
{
    public class GetIntegrationsQueryHandler : IRequestHandler<GetIntegrationsQuery, List<IntegrationConfigurationResponseDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIntegrationCredentialProtector _credentials;

        public GetIntegrationsQueryHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IIntegrationCredentialProtector credentials)
        {
            _repository = repository;
            _logger = logger;
            _credentials = credentials;
        }

        public async Task<List<IntegrationConfigurationResponseDto>> Handle(GetIntegrationsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching integrations. OrganizationId: {request.OrganizationId}");
            List<ApiIntegrationConfiguration> configurations = await _repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.OrganizationId == request.OrganizationId && x.IsActive)
                .OrderBy(x => x.Name)
                .ToListAsync(cancellationToken);
            _logger.LogInfo($"Integrations fetched. Count: {configurations.Count}, OrganizationId: {request.OrganizationId}");
            return configurations.Select(item => IntegrationResponseBuilder.Integration(item, _credentials)).ToList();
        }
    }
}

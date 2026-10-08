using Buyer.Application.Features.Shared;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Queries.GetIntegrations
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
                .FindByCondition(x => IntegrationLookup.BuyerIdsOf(_repository, request.OrganizationId).Contains(x.BuyerId) && x.IsActive)
                .OrderBy(x => x.Name)
                .ToListAsync(cancellationToken);
            _logger.LogInfo($"Integrations fetched. Count: {configurations.Count}, OrganizationId: {request.OrganizationId}");
            return configurations.Select(item => IntegrationResponseBuilder.Integration(item, _credentials)).ToList();
        }
    }
}

using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;
using SharedKernel.LoggerServices;
using Supplier.Infrastructure.Contracts.IRepository;

namespace Supplier.Application.Features.Queries.GetIntegrationExecutions
{
    public class GetIntegrationExecutionsQueryHandler : IRequestHandler<GetIntegrationExecutionsQuery, List<IntegrationExecutionResponseDto>>
    {
        private const int MAX_EXECUTIONS = 100;
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetIntegrationExecutionsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<IntegrationExecutionResponseDto>> Handle(GetIntegrationExecutionsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching integration executions. ConfigurationId: {request.ConfigurationId}, OrganizationId: {request.OrganizationId}");
            List<Guid> configurationIds = await _repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.OrganizationId == request.OrganizationId
                    && (request.ConfigurationId == null || x.Id == request.ConfigurationId))
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            List<ApiIntegrationExecution> executions = await _repository.ApiIntegrationExecution
                .FindByCondition(x => configurationIds.Contains(x.ConfigurationId))
                .OrderByDescending(x => x.StartedAt)
                .Take(MAX_EXECUTIONS)
                .ToListAsync(cancellationToken);
            _logger.LogInfo($"Integration executions fetched. Count: {executions.Count}, OrganizationId: {request.OrganizationId}");
            return executions.Select(IntegrationResponseBuilder.Execution).ToList();
        }
    }
}

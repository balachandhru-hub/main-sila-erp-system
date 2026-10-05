using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;
using SharedKernel.LoggerServices;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Queries.GetIntegrationSchema
{
    public class GetIntegrationSchemaQueryHandler : IRequestHandler<GetIntegrationSchemaQuery, IntegrationSchemaResponseDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetIntegrationSchemaQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<IntegrationSchemaResponseDto> Handle(GetIntegrationSchemaQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching integration schema. ConfigurationId: {request.ConfigurationId}, OrganizationId: {request.OrganizationId}");
            bool exists = await _repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.Id == request.ConfigurationId && x.OrganizationId == request.OrganizationId && x.IsActive)
                .AnyAsync(cancellationToken);
            IntegrationSchemaSnapshot? snapshot = !exists
                ? null
                : await _repository.IntegrationSchemaSnapshot
                    .FindByCondition(x => x.ConfigurationId == request.ConfigurationId)
                    .OrderByDescending(x => x.DiscoveredAt)
                    .FirstOrDefaultAsync(cancellationToken);
            if (snapshot == null)
            {
                _logger.LogError($"Integration schema not found. ConfigurationId: {request.ConfigurationId}, OrganizationId: {request.OrganizationId}");
                throw new NotFoundCustomException("Schema not found.", "No schema has been discovered for this integration yet.");
            }

            _logger.LogInfo($"Integration schema fetched. ConfigurationId: {request.ConfigurationId}");
            return IntegrationResponseBuilder.Schema(snapshot);
        }
    }
}

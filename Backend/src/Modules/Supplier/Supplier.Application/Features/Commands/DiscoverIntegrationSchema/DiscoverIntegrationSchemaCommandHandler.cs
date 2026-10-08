using MediatR;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;
using Supplier.Application.Features.Shared;
using Supplier.Infrastructure.Contracts.IRepository;

namespace Supplier.Application.Features.Commands.DiscoverIntegrationSchema
{
    public class DiscoverIntegrationSchemaCommandHandler : IRequestHandler<DiscoverIntegrationSchemaCommand, IntegrationSchemaResponseDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIntegrationHttpExecutor _executor;

        public DiscoverIntegrationSchemaCommandHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IIntegrationHttpExecutor executor)
        {
            _repository = repository;
            _logger = logger;
            _executor = executor;
        }

        public async Task<IntegrationSchemaResponseDto> Handle(DiscoverIntegrationSchemaCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Discovering integration schema. ConfigurationId: {request.ConfigurationId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            ApiIntegrationConfiguration configuration = await IntegrationLookup.GetTrackedAsync(_repository, _logger, request.ConfigurationId, request.OrganizationId);
            IntegrationSchemaSnapshot snapshot = await IntegrationSchemaRules.DiscoverAsync(_executor, _logger, configuration, cancellationToken);
            _repository.IntegrationSchemaSnapshot.Create(snapshot);
            await _repository.SaveAsync();
            IntegrationSchemaResponseDto result = IntegrationResponseBuilder.Schema(snapshot);
            _logger.LogInfo($"Integration schema discovered. ConfigurationId: {configuration.Id}, Entities: {result.Entities.Count}");
            return result;
        }
    }
}

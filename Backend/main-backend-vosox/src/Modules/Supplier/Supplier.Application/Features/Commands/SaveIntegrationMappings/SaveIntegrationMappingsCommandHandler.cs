using MediatR;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;
using SharedKernel.LoggerServices;
using Supplier.Application.Features.Shared;
using Supplier.Infrastructure.Contracts.IRepository;

namespace Supplier.Application.Features.Commands.SaveIntegrationMappings
{
    public class SaveIntegrationMappingsCommandHandler : IRequestHandler<SaveIntegrationMappingsCommand, List<IntegrationMappingResponseDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SaveIntegrationMappingsCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<IntegrationMappingResponseDto>> Handle(SaveIntegrationMappingsCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Saving integration mappings. ConfigurationId: {request.ConfigurationId}, Count: {request.Mappings.Count}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            ApiIntegrationConfiguration configuration = await IntegrationLookup.GetTrackedAsync(_repository, _logger, request.ConfigurationId, request.OrganizationId);
            List<ApiFieldMapping> mappings = IntegrationMappingRules.Build(_logger, configuration, request.Mappings);
            List<ApiFieldMapping> existing = await _repository.ApiFieldMapping.GetTrackedByConfigurationAsync(configuration.Id, cancellationToken);
            _repository.ApiFieldMapping.DeleteRange(existing);
            _repository.ApiFieldMapping.CreateRange(mappings);
            await _repository.SaveAsync();
            _logger.LogInfo($"Integration mappings saved. ConfigurationId: {configuration.Id}, Count: {mappings.Count}");
            return mappings.OrderBy(item => item.TargetField).Select(IntegrationResponseBuilder.Mapping).ToList();
        }
    }
}

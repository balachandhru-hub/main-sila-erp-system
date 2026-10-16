using Buyer.Application.Features.Shared;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DeleteIntegration
{
    /// <summary>
    /// Deletes an integration of the organization. Mappings, the discovered schema and run history go with it.
    /// The unique key is buyer, entity code and API type, so the row is removed rather than deactivated.
    /// </summary>
    public class DeleteIntegrationCommandHandler : IRequestHandler<DeleteIntegrationCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DeleteIntegrationCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(DeleteIntegrationCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deleting integration. ConfigurationId: {request.ConfigurationId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            ApiIntegrationConfiguration configuration = await IntegrationLookup.GetTrackedAsync(_repository, _logger, request.ConfigurationId, request.OrganizationId);
            if (configuration.IsRunning)
            {
                _logger.LogError($"Integration is running and cannot be deleted. ConfigurationId: {configuration.Id}");
                throw new ConflictCustomException("Integration is running.", "Wait for the current run to finish, then delete the API.");
            }

            List<ApiFieldMapping> mappings = await _repository.ApiFieldMapping
                .FindByCondition(x => x.ConfigurationId == configuration.Id)
                .ToListAsync(cancellationToken);
            List<ApiIntegrationExecution> executions = await _repository.ApiIntegrationExecution
                .FindByCondition(x => x.ConfigurationId == configuration.Id)
                .ToListAsync(cancellationToken);
            List<IntegrationSchemaSnapshot> schemas = await _repository.IntegrationSchemaSnapshot
                .FindByCondition(x => x.ConfigurationId == configuration.Id)
                .ToListAsync(cancellationToken);

            _repository.ApiFieldMapping.DeleteRange(mappings);
            _repository.ApiIntegrationExecution.DeleteRange(executions);
            _repository.IntegrationSchemaSnapshot.DeleteRange(schemas);
            _repository.ApiIntegrationConfiguration.Delete(configuration);
            await _repository.SaveAsync();
            _logger.LogInfo($"Integration deleted. ConfigurationId: {configuration.Id}, Mappings: {mappings.Count}, Executions: {executions.Count}");
            return Unit.Value;
        }
    }
}

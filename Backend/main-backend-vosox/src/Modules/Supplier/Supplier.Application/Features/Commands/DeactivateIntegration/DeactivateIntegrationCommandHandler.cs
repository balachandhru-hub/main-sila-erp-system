using MediatR;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;
using Supplier.Application.Features.Shared;
using Supplier.Infrastructure.Contracts.IRepository;

namespace Supplier.Application.Features.Commands.DeactivateIntegration
{
    public class DeactivateIntegrationCommandHandler : IRequestHandler<DeactivateIntegrationCommand, bool>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DeactivateIntegrationCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<bool> Handle(DeactivateIntegrationCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deactivating integration. ConfigurationId: {request.ConfigurationId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            ApiIntegrationConfiguration configuration = await IntegrationLookup.GetTrackedAsync(_repository, _logger, request.ConfigurationId, request.OrganizationId);
            configuration.Status = IntegrationConfigurationStatus.INACTIVE;
            configuration.NextRunAt = null;
            await _repository.SaveAsync();
            _logger.LogInfo($"Integration deactivated. ConfigurationId: {configuration.Id}");
            return false;
        }
    }
}

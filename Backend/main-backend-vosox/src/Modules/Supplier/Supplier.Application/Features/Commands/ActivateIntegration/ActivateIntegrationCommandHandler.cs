using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;
using Supplier.Application.Features.Shared;
using Supplier.Infrastructure.Contracts.IRepository;

namespace Supplier.Application.Features.Commands.ActivateIntegration
{
    public class ActivateIntegrationCommandHandler : IRequestHandler<ActivateIntegrationCommand, bool>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ActivateIntegrationCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<bool> Handle(ActivateIntegrationCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Activating integration. ConfigurationId: {request.ConfigurationId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            ApiIntegrationConfiguration configuration = await IntegrationLookup.GetTrackedAsync(_repository, _logger, request.ConfigurationId, request.OrganizationId);
            if (configuration.Status is not (IntegrationConfigurationStatus.TESTED or IntegrationConfigurationStatus.ACTIVE))
            {
                _logger.LogError($"Integration was not tested. ConfigurationId: {configuration.Id}, Status: {configuration.Status}");
                throw new BadRequestCustomException("Test is required.", "Test the API successfully before activating this configuration.");
            }

            configuration.Status = IntegrationConfigurationStatus.ACTIVE;
            configuration.NextRunAt = DateTime.UtcNow;
            await _repository.SaveAsync();
            _logger.LogInfo($"Integration activated. ConfigurationId: {configuration.Id}");
            return true;
        }
    }
}

using MediatR;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Commands.UpdateIntegration
{
    public class UpdateIntegrationCommandHandler : IRequestHandler<UpdateIntegrationCommand, IntegrationConfigurationResponseDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIntegrationCredentialProtector _credentials;

        public UpdateIntegrationCommandHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IIntegrationCredentialProtector credentials)
        {
            _repository = repository;
            _logger = logger;
            _credentials = credentials;
        }

        public async Task<IntegrationConfigurationResponseDto> Handle(UpdateIntegrationCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Updating integration. ConfigurationId: {request.ConfigurationId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            ApiIntegrationConfiguration configuration = await IntegrationLookup.GetTrackedAsync(_repository, _logger, request.ConfigurationId, request.OrganizationId);
            IntegrationConfigurationRules.Validate(_logger, request.Request, Common.INTEGRATION_SIDE, request.OrganizationType, request.OrganizationId);
            await IntegrationLookup.EnsureEntityCodeAsync(_repository, _logger, request.OrganizationId, request.Request.EntityCode, configuration.EntityCode, cancellationToken);
            if (await IntegrationLookup.HasOtherOfTypeAsync(_repository, configuration, request.Request.ProcessType, request.Request.EntityCode, cancellationToken))
            {
                throw IntegrationConfigurationRules.Duplicate(_logger, request.Request, request.OrganizationId);
            }

            IntegrationConfigurationRules.Apply(_credentials, configuration, request.Request);
            if (configuration.Status != IntegrationConfigurationStatus.ACTIVE)
            {
                configuration.Status = IntegrationConfigurationStatus.DRAFT;
            }

            await _repository.SaveAsync();
            _logger.LogInfo($"Integration updated. ConfigurationId: {configuration.Id}, OrganizationId: {request.OrganizationId}");
            return IntegrationResponseBuilder.Integration(configuration, _credentials);
        }
    }
}

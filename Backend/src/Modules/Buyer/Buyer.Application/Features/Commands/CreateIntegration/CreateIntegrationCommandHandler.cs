using MediatR;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Commands.CreateIntegration
{
    public class CreateIntegrationCommandHandler : IRequestHandler<CreateIntegrationCommand, IntegrationConfigurationResponseDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIntegrationCredentialProtector _credentials;

        public CreateIntegrationCommandHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IIntegrationCredentialProtector credentials)
        {
            _repository = repository;
            _logger = logger;
            _credentials = credentials;
        }

        public async Task<IntegrationConfigurationResponseDto> Handle(CreateIntegrationCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Creating integration. Name: {request.Request.Name}, ProcessType: {request.Request.ProcessType}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            ApiIntegrationConfiguration configuration = new ApiIntegrationConfiguration
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                Status = IntegrationConfigurationStatus.DRAFT
            };
            IntegrationConfigurationRules.Validate(_logger, request.Request, Common.INTEGRATION_SIDE, request.OrganizationType, request.OrganizationId);
            await IntegrationLookup.EnsureEntityCodeAsync(_repository, _logger, request.OrganizationId, request.Request.EntityCode, null, cancellationToken);
            if (await IntegrationLookup.HasOtherOfTypeAsync(_repository, configuration, request.Request.ProcessType, request.Request.EntityCode, cancellationToken))
            {
                throw IntegrationConfigurationRules.Duplicate(_logger, request.Request, request.OrganizationId);
            }

            IntegrationConfigurationRules.Apply(_credentials, configuration, request.Request);
            _repository.ApiIntegrationConfiguration.Create(configuration);
            await _repository.SaveAsync();
            _logger.LogInfo($"Integration created. ConfigurationId: {configuration.Id}, OrganizationId: {request.OrganizationId}");
            return IntegrationResponseBuilder.Integration(configuration, _credentials);
        }
    }
}

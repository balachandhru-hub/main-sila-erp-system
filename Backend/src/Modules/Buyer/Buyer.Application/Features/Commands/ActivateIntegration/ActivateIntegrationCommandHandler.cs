using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;
using Buyer.Application.Features.Shared;
using Buyer.Application.Services;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.Contracts.IServices;

namespace Buyer.Application.Features.Commands.ActivateIntegration
{
    public class ActivateIntegrationCommandHandler : IRequestHandler<ActivateIntegrationCommand, bool>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IMediator _mediator;
        private readonly IUserContext _userContext;
        private readonly ILoggerManager _logger;

        public ActivateIntegrationCommandHandler(IRepositoryWrapper repository, IMediator mediator, IUserContext userContext, ILoggerManager logger)
        {
            _repository = repository;
            _mediator = mediator;
            _userContext = userContext;
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

            if (configuration.ProcessType == IntegrationProcessType.POST_CONTRACT)
            {
                // Contracts created before this API existed are sent to the ERP now.
                BuyerBusinessProfile? buyer = _repository.BuyerBusinessProfile.FindFirstByCondition(
                    x => x.OrganizationId == request.OrganizationId && x.IsActive);
                if (buyer != null)
                {
                    await new ContractErpIntegrationProcessor(_repository, _mediator, _userContext, _logger)
                        .ReprocessPendingAsync(buyer.Id, buyer.OrganizationId, request.UserId, cancellationToken);
                }
            }

            return true;
        }
    }
}

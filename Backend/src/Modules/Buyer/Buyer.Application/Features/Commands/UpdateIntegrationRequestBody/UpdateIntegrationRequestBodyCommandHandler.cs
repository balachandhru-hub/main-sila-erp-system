using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;
using Buyer.Application.Features.Shared;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Commands.UpdateIntegrationRequestBody
{
    public class UpdateIntegrationRequestBodyCommandHandler : IRequestHandler<UpdateIntegrationRequestBodyCommand, IntegrationConfigurationResponseDto>
    {
        private static readonly string[] PayloadFormats = { IntegrationConstants.PAYLOAD_JSON, "SOAP", "CXML" };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIntegrationCredentialProtector _credentials;

        public UpdateIntegrationRequestBodyCommandHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IIntegrationCredentialProtector credentials)
        {
            _repository = repository;
            _logger = logger;
            _credentials = credentials;
        }

        public async Task<IntegrationConfigurationResponseDto> Handle(UpdateIntegrationRequestBodyCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Updating integration request body. ConfigurationId: {request.ConfigurationId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            ApiIntegrationConfiguration configuration = await IntegrationLookup.GetTrackedAsync(_repository, _logger, request.ConfigurationId, request.OrganizationId);

            if (IntegrationProcessCatalog.Find(configuration.ProcessType)?.IsPush != true)
            {
                _logger.LogError($"Integration has no request body. ConfigurationId: {configuration.Id}, ProcessType: {configuration.ProcessType}");
                throw new BadRequestCustomException("No request body.", "Only an API the application sends to has a request body.");
            }

            string payloadFormat = string.IsNullOrWhiteSpace(request.PayloadFormat) ? configuration.PayloadFormat : request.PayloadFormat.Trim().ToUpperInvariant();
            if (!PayloadFormats.Contains(payloadFormat))
            {
                throw new BadRequestCustomException("Invalid payload format.", "Use JSON, SOAP or CXML.");
            }

            if (payloadFormat != IntegrationConstants.PAYLOAD_JSON && string.IsNullOrWhiteSpace(request.RequestBody))
            {
                _logger.LogError($"Integration body template is missing. PayloadFormat: {payloadFormat}, ConfigurationId: {configuration.Id}");
                throw new BadRequestCustomException("Request body is required.", "SOAP and cXML calls need the request body saved on this API.");
            }

            configuration.PayloadFormat = payloadFormat;
            configuration.RequestBody = string.IsNullOrWhiteSpace(request.RequestBody) ? null : request.RequestBody;
            await _repository.SaveAsync();
            _logger.LogInfo($"Integration request body updated. ConfigurationId: {configuration.Id}");
            return IntegrationResponseBuilder.Integration(configuration, _credentials);
        }
    }
}

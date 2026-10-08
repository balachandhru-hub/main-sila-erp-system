using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SaveSilaOcrConfiguration
{
    public class SaveSilaOcrConfigurationCommandHandler : IRequestHandler<SaveSilaOcrConfigurationCommand, SilaOcrConfigurationDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SaveSilaOcrConfigurationCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaOcrConfigurationDto> Handle(SaveSilaOcrConfigurationCommand request, CancellationToken cancellationToken)
        {
            SilaOcrConfigurationWriteDto input = request.Request;
            string provider = (input.Provider ?? string.Empty).Trim().ToUpperInvariant();
            _logger.LogInfo($"Saving OCR configuration. OrganizationId: {request.OrganizationId}, Provider: {provider}, AutoExtract: {input.AutoExtractOnUpload}, MinimumConfidence: {input.MinimumConfidence}");
            if (provider != SilaOcrSettings.PROVIDER_BUILT_IN && provider != SilaOcrSettings.PROVIDER_EXTERNAL)
            {
                _logger.LogError($"OCR provider is invalid. Provider: {provider}");
                throw new BadRequestCustomException("Invalid provider.", "Choose BUILT_IN (the OCR service) or EXTERNAL (the EXTRACT_INVOICE integration).");
            }

            if (input.MinimumConfidence < 0 || input.MinimumConfidence > 1)
            {
                _logger.LogError($"OCR minimum confidence out of range. MinimumConfidence: {input.MinimumConfidence}");
                throw new BadRequestCustomException("Invalid minimum confidence.", "Enter a minimum confidence between 0 and 1 (for example 0.75 for 75 %).");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            SilaOcrConfiguration? configuration = await _repository.SilaOcrConfiguration.FindFirstByConditionAsync(x => x.BuyerId == buyer.Id);
            bool isNew = configuration == null;
            configuration ??= new SilaOcrConfiguration { Id = Guid.NewGuid(), BuyerId = buyer.Id };
            configuration.Provider = provider;
            configuration.AutoExtractOnUpload = input.AutoExtractOnUpload;
            configuration.MinimumConfidence = Math.Round(input.MinimumConfidence, 4);
            SilaOcrPolicy.Apply(_logger, configuration, input);
            configuration.IsActive = true;
            if (isNew)
            {
                _repository.SilaOcrConfiguration.Create(configuration);
            }

            await _repository.SaveAsync();
            SilaOcrConfigurationDto result = await SilaOcrSettings.ToDtoAsync(_repository, buyer, configuration, cancellationToken);
            if (provider == SilaOcrSettings.PROVIDER_EXTERNAL && !result.ExternalConfigured)
            {
                _logger.LogInfo($"OCR set to EXTERNAL without an active EXTRACT_INVOICE API. BuyerId: {buyer.Id}");
            }

            _logger.LogInfo($"OCR configuration saved. BuyerId: {buyer.Id}");
            return result;
        }
    }
}

using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.Extensions.Configuration;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaOcrConfiguration
{
    public class GetSilaOcrConfigurationQueryHandler : IRequestHandler<GetSilaOcrConfigurationQuery, SilaOcrConfigurationDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IConfiguration _configuration;

        public GetSilaOcrConfigurationQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IConfiguration configuration)
        {
            _repository = repository;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<SilaOcrConfigurationDto> Handle(GetSilaOcrConfigurationQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching OCR configuration. OrganizationId: {request.OrganizationId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            SilaOcrConfiguration configuration = await SilaOcrSettings.GetAsync(_repository, buyer.Id, cancellationToken);
            SilaOcrConfigurationDto result = await SilaOcrSettings.ToDtoAsync(
                _repository, buyer, configuration, cancellationToken, _configuration[Common.BASE_FOLDER_PATH]);
            _logger.LogInfo($"OCR configuration fetched. BuyerId: {buyer.Id}, Provider: {result.Provider}, Saved: {result.Saved}");
            return result;
        }
    }
}

using System.Text.Json;
using Buyer.Domain.Dtos;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;
using Buyer.Application.Features.Shared;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Queries.GetLiveStock
{
    /// <summary>
    /// Stock in hand is not stored: it is read from the organization's stock API each time it is
    /// asked for, so the answer is the ERP's figure of that moment.
    /// </summary>
    public class GetLiveStockQueryHandler : IRequestHandler<GetLiveStockQuery, StockInHandResponseDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIntegrationHttpExecutor _executor;

        public GetLiveStockQueryHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IIntegrationHttpExecutor executor)
        {
            _repository = repository;
            _logger = logger;
            _executor = executor;
        }

        public async Task<StockInHandResponseDto> Handle(GetLiveStockQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Reading live stock. OrganizationId: {request.OrganizationId}");
            StockInHandResponseDto result = new StockInHandResponseDto();
            List<ApiIntegrationConfiguration> configurations = await _repository.ApiIntegrationConfiguration
                .FindByCondition(x => IntegrationLookup.BuyerIdsOf(_repository, request.OrganizationId).Contains(x.BuyerId)
                    && x.ProcessType == IntegrationProcessType.GET_STOCK
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.IsActive)
                .ToListAsync(cancellationToken);
            if (configurations.Count == 0)
            {
                _logger.LogInfo($"No active stock API. OrganizationId: {request.OrganizationId}");
                return result;
            }

            result.Configured = true;
            foreach (ApiIntegrationConfiguration configuration in configurations)
            {
                List<ApiFieldMapping> mappings = await _repository.ApiFieldMapping
                    .FindByCondition(x => x.ConfigurationId == configuration.Id)
                    .ToListAsync(cancellationToken);
                try
                {
                    List<JsonElement> records = await _executor.PullRecordsAsync(configuration, false, cancellationToken);
                    foreach (JsonElement record in records)
                    {
                        try
                        {
                            result.Items.Add(IntegrationStockRules.ReadStock(mappings, record));
                        }
                        catch (InvalidOperationException)
                        {
                            // A record without a material code or quantity says nothing about any stock.
                        }
                    }
                }
                catch (IntegrationException exception)
                {
                    // The stock of this entity is then simply not known; the caller shows it as such.
                    result.Failed = true;
                    _logger.LogError($"Live stock could not be read. ConfigurationId: {configuration.Id}, Code: {exception.Code}, Error: {exception.Message}");
                }
            }

            _logger.LogInfo($"Live stock read. OrganizationId: {request.OrganizationId}, Items: {result.Items.Count}");
            return result;
        }
    }
}

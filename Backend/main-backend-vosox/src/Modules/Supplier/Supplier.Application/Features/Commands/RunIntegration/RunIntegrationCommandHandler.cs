using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;
using Supplier.Application.Features.Commands.SupplierCatalog;
using Supplier.Domain.Dto;
using Supplier.Application.Features.Shared;
using Supplier.Infrastructure.Contracts.IRepository;

namespace Supplier.Application.Features.Commands.RunIntegration
{
    public class RunIntegrationCommandHandler : IRequestHandler<RunIntegrationCommand, IntegrationExecutionResponseDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIntegrationHttpExecutor _executor;
        private readonly IMediator _mediator;
        public RunIntegrationCommandHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IIntegrationHttpExecutor executor,
            IMediator mediator)
        {
            _repository = repository;
            _logger = logger;
            _executor = executor;
            _mediator = mediator;
        }

        public async Task<IntegrationExecutionResponseDto> Handle(RunIntegrationCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Running integration. ConfigurationId: {request.ConfigurationId}, Trigger: {request.Trigger}, FullSync: {request.FullSync}, OrganizationId: {request.OrganizationId}");
            bool claimed = await _repository.ApiIntegrationConfiguration.TryClaimAsync(request.ConfigurationId, request.OrganizationId, cancellationToken);
            if (!claimed)
            {
                bool exists = await _repository.ApiIntegrationConfiguration
                    .FindByCondition(x => x.Id == request.ConfigurationId && x.OrganizationId == request.OrganizationId && x.IsActive)
                    .AnyAsync(cancellationToken);
                if (!exists)
                {
                    _logger.LogError($"Integration configuration not found. ConfigurationId: {request.ConfigurationId}, OrganizationId: {request.OrganizationId}");
                    throw new NotFoundCustomException("Integration not found.", "The integration configuration does not exist in your organization.");
                }

                _logger.LogError($"Integration is already running or inactive. ConfigurationId: {request.ConfigurationId}");
                throw new ConflictCustomException("Integration is busy.", "This integration is already running or is inactive.");
            }

            ApiIntegrationConfiguration configuration = await IntegrationLookup.GetTrackedAsync(_repository, _logger, request.ConfigurationId, request.OrganizationId);
            ApiIntegrationExecution execution = IntegrationRunRules.NewExecution(configuration, request.Trigger, request.FullSync);
            _repository.ApiIntegrationExecution.Create(execution);
            try
            {
                List<ApiFieldMapping> mappings = await _repository.ApiFieldMapping
                    .FindByCondition(x => x.ConfigurationId == configuration.Id)
                    .ToListAsync(cancellationToken);
                IntegrationRunRules.EnsureRunnable(configuration, mappings);
                List<JsonElement> records = await _executor.PullRecordsAsync(configuration, request.FullSync, cancellationToken);
                await ApplyRecordsAsync(configuration, mappings, records, execution, cancellationToken);
                IntegrationRunRules.Complete(configuration, execution);
                await _repository.SaveAsync();
            }
            catch (Exception exception) when (exception is IntegrationException or DbUpdateException or JsonException or OperationCanceledException)
            {
                // Nothing of a failed run is kept: the tracked changes are dropped and only the failure is recorded.
                IntegrationException failure = exception switch
                {
                    IntegrationException integrationException => integrationException,
                    OperationCanceledException => new IntegrationException("RUN_CANCELLED", "The run was stopped before it finished. No records were changed.", 424),
                    _ => new IntegrationException("INTEGRATION_FAILED", "The integration run failed. No records were changed.")
                };
                _logger.LogError($"Integration run failed. ConfigurationId: {request.ConfigurationId}, Code: {failure.Code}, Error: {exception.Message}");
                _repository.ApiIntegrationExecution.DetachAllEntities();
                ApiIntegrationConfiguration failed = await IntegrationLookup.GetTrackedAsync(_repository, _logger, request.ConfigurationId, request.OrganizationId);
                _repository.ApiIntegrationExecution.Create(IntegrationRunRules.Fail(failed, request.Trigger, request.FullSync, execution, failure));
                await _repository.SaveAsync();
                throw IntegrationErrors.ToCustomException(failure);
            }

            _logger.LogInfo($"Integration run completed. ConfigurationId: {configuration.Id}, Status: {execution.Status}, Read: {execution.RecordsRead}, Created: {execution.RecordsCreated}, Updated: {execution.RecordsUpdated}, Failed: {execution.RecordsFailed}");
            return IntegrationResponseBuilder.Execution(execution);
        }

        // Products (GET_CATALOG) or the stock of existing products (GET_CATALOG_STOCK) go into the
        // supplier's catalog, matched by SKU.
        private async Task ApplyRecordsAsync(
            ApiIntegrationConfiguration configuration,
            List<ApiFieldMapping> mappings,
            List<JsonElement> records,
            ApiIntegrationExecution execution,
            CancellationToken cancellationToken)
        {
            List<SupplierCatalogSyncItemDto> items = new List<SupplierCatalogSyncItemDto>();
            foreach (JsonElement record in records)
            {
                execution.RecordsRead++;
                try
                {
                    items.Add(IntegrationCatalogRules.ReadCatalogItem(configuration.ProcessType, mappings, record));
                }
                catch (InvalidOperationException exception)
                {
                    IntegrationRunRules.RecordFailed(execution, "One or more records could not be read.");
                    _logger.LogError($"Integration record could not be read. ConfigurationId: {configuration.Id}, Record: {execution.RecordsRead}, Error: {exception.Message}");
                }
            }

            if (items.Count == 0)
            {
                return;
            }

            SupplierCatalogSyncResultDto result;
            try
            {
                result = await _mediator.Send(new SyncSupplierCatalogCommand
                {
                    Request = new SupplierCatalogSyncRequestDto
                    {
                        OrganizationId = configuration.OrganizationId,
                        Mode = configuration.ProcessType == IntegrationProcessType.GET_CATALOG
                            ? SupplierCatalogSyncRequestDto.MODE_CATALOG
                            : SupplierCatalogSyncRequestDto.MODE_STOCK,
                        Items = items
                    }
                }, cancellationToken);
            }
            catch (BaseCustomException exception)
            {
                _logger.LogError($"Supplier catalog could not be updated. ConfigurationId: {configuration.Id}, Error: {exception.Message}");
                throw new IntegrationException("CATALOG_UPDATE_FAILED", "The supplier catalog could not be updated.", 424);
            }

            execution.RecordsCreated += result.Created;
            execution.RecordsUpdated += result.Updated;
            if (result.Skipped > 0)
            {
                execution.RecordsFailed += result.Skipped;
                execution.ErrorMessageSafe = "Some SKUs are not in the catalog.";
            }
        }
    }
}

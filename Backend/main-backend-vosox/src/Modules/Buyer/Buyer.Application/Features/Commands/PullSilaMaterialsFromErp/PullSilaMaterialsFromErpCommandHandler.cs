using System.Text.Json;
using Buyer.Application.Features.Queries.ResolveIntegration;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.PullSilaMaterialsFromErp
{
    /// <summary>
    /// Pulls the materials of a company code through the GET_MATERIAL API of the integration engine (the company code's own
    /// configuration, else the organization-wide one), records the run like any integration run and applies the records.
    /// </summary>
    public class PullSilaMaterialsFromErpCommandHandler : IRequestHandler<PullSilaMaterialsFromErpCommand, SilaMaterialErpPullResultDto>
    {
        private const int MAX_COMPANY_CODE_LENGTH = 20;

        private readonly IRepositoryWrapper _repository;
        private readonly IMediator _mediator;
        private readonly IIntegrationHttpExecutor _executor;
        private readonly ILoggerManager _logger;

        public PullSilaMaterialsFromErpCommandHandler(
            IRepositoryWrapper repository, IMediator mediator, IIntegrationHttpExecutor executor, ILoggerManager logger)
        {
            _repository = repository;
            _mediator = mediator;
            _executor = executor;
            _logger = logger;
        }

        public async Task<SilaMaterialErpPullResultDto> Handle(PullSilaMaterialsFromErpCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Pulling materials from the ERP. OrganizationId: {request.OrganizationId}, CompanyCode: {request.Request.CompanyCode}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            string companyCode = request.Request.CompanyCode?.Trim().ToUpperInvariant() ?? string.Empty;
            if (companyCode.Length == 0 || companyCode.Length > MAX_COMPANY_CODE_LENGTH)
            {
                _logger.LogError($"ERP material pull without a valid company code. OrganizationId: {request.OrganizationId}");
                throw new BadRequestCustomException("Company code is required.", $"Select the company code (at most {MAX_COMPANY_CODE_LENGTH} characters) whose materials to pull.");
            }

            IntegrationApiDto api = await _mediator.Send(new ResolveIntegrationQuery
            {
                OrganizationId = request.OrganizationId,
                ProcessType = IntegrationProcessType.GET_MATERIAL,
                EntityCode = companyCode
            }, cancellationToken);
            if (!api.Configured || api.ConfigurationId == null)
            {
                _logger.LogError($"No active GET_MATERIAL API. OrganizationId: {request.OrganizationId}, CompanyCode: {companyCode}");
                throw new BadRequestCustomException(
                    "The ERP material API is not configured.",
                    $"Configure and activate a GET_MATERIAL API for company code {companyCode} (or ALL) under Integration first.");
            }

            bool claimed = await _repository.ApiIntegrationConfiguration.TryClaimAsync(api.ConfigurationId.Value, request.OrganizationId, cancellationToken);
            if (!claimed)
            {
                _logger.LogError($"GET_MATERIAL API is busy. ConfigurationId: {api.ConfigurationId}");
                throw new ConflictCustomException("The ERP material pull is already running.", "Wait until the current pull finishes, then try again.");
            }

            ApiIntegrationConfiguration configuration = await IntegrationLookup.GetTrackedAsync(_repository, _logger, api.ConfigurationId.Value, request.OrganizationId);
            ApiIntegrationExecution execution = IntegrationRunRules.NewExecution(configuration, IntegrationExecutionTrigger.MANUAL, true);
            _repository.ApiIntegrationExecution.Create(execution);
            SilaMaterialErpPullResultDto result = new SilaMaterialErpPullResultDto { ConfigurationName = configuration.Name };
            try
            {
                List<ApiFieldMapping> mappings = await _repository.ApiFieldMapping
                    .FindByCondition(x => x.ConfigurationId == configuration.Id)
                    .ToListAsync(cancellationToken);
                if (!mappings.Any(x => x.TargetField.Equals("Material.Code", StringComparison.OrdinalIgnoreCase)))
                {
                    throw new IntegrationException("MAPPING_REQUIRED", "Map the ERP field that holds the material code to Material.Code before pulling.");
                }

                List<JsonElement> records = await _executor.PullRecordsAsync(configuration, true, cancellationToken);
                await SilaMaterialErpSync.ApplyAsync(
                    _repository, _logger, buyer.Id, request.UserId, companyCode, mappings, records, result, cancellationToken);
                execution.RecordsRead = result.Read;
                execution.RecordsCreated = result.New;
                execution.RecordsUpdated = result.Changed;
                if (result.Failed > 0)
                {
                    execution.RecordsFailed = result.Failed;
                    execution.ErrorMessageSafe = "One or more material records could not be applied.";
                }

                IntegrationRunRules.Complete(configuration, execution);
                await _repository.SaveAsync();
            }
            catch (Exception exception) when (exception is IntegrationException or DbUpdateException or JsonException or BaseCustomException)
            {
                // Nothing of a failed pull is kept: the tracked changes are dropped and only the failure is recorded.
                IntegrationException failure = exception as IntegrationException
                    ?? new IntegrationException("INTEGRATION_FAILED", "The material pull failed. No materials were changed.");
                _logger.LogError($"ERP material pull failed. ConfigurationId: {configuration.Id}, Code: {failure.Code}, Error: {SilaLogText.Short(exception.Message)}");
                SilaRetry.DiscardChanges(_repository);
                ApiIntegrationConfiguration failed = await IntegrationLookup.GetTrackedAsync(_repository, _logger, configuration.Id, request.OrganizationId);
                _repository.ApiIntegrationExecution.Create(IntegrationRunRules.Fail(failed, IntegrationExecutionTrigger.MANUAL, true, execution, failure));
                await _repository.SaveAsync();
                if (exception is BaseCustomException)
                {
                    throw;
                }

                throw IntegrationErrors.ToCustomException(failure);
            }

            _logger.LogInfo(
                $"ERP materials pulled. ConfigurationId: {configuration.Id}, Read: {result.Read}, New: {result.New}, Changed: {result.Changed}, Unchanged: {result.Unchanged}, Failed: {result.Failed}, PriceChanges: {result.PriceChanges}");
            return result;
        }
    }
}

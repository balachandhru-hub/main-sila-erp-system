using System.Text.Json;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.PullSilaPurchaseOrders
{
    /// <summary>
    /// Every active GET_PO API is read (one per company code, or the organization-wide one). Valid purchase orders are
    /// written in one save; invalid ones are skipped and reported. A purchase order sent by two APIs is taken once.
    /// </summary>
    public class PullSilaPurchaseOrdersCommandHandler : IRequestHandler<PullSilaPurchaseOrdersCommand, SilaMasterPullResultDto>
    {
        private const int ERROR_LIMIT = 50;

        private readonly IRepositoryWrapper _repository;
        private readonly IIntegrationHttpExecutor _executor;
        private readonly ILoggerManager _logger;

        public PullSilaPurchaseOrdersCommandHandler(IRepositoryWrapper repository, IIntegrationHttpExecutor executor, ILoggerManager logger)
        {
            _repository = repository;
            _executor = executor;
            _logger = logger;
        }

        public async Task<SilaMasterPullResultDto> Handle(PullSilaPurchaseOrdersCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Pulling purchase orders from the ERP. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<ApiIntegrationConfiguration> configurations = await SilaErpPull.ActiveConfigurationsAsync(
                _repository, request.OrganizationId, IntegrationProcessType.GET_PO, cancellationToken);
            if (configurations.Count == 0)
            {
                _logger.LogError($"No active purchase order API. OrganizationId: {request.OrganizationId}");
                throw new BadRequestCustomException("Purchase order API is not configured.", "Configure and activate a GET_PO API under Integration first.");
            }

            SilaMasterPullResultDto result = new SilaMasterPullResultDto { Apis = configurations.Count };
            List<SilaPoImportRowDto> rows = new List<SilaPoImportRowDto>();
            HashSet<string> taken = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            int rowNumber = 0;
            foreach (ApiIntegrationConfiguration configuration in configurations)
            {
                List<ApiFieldMapping> mappings = await _repository.ApiFieldMapping
                    .FindByCondition(x => x.ConfigurationId == configuration.Id && x.IsActive)
                    .ToListAsync(cancellationToken);
                List<JsonElement> records = await SilaErpPull.ReadAsync(_executor, _logger, configuration, "purchase order", cancellationToken);
                List<SilaPoImportRowDto> lines = new List<SilaPoImportRowDto>();
                foreach (JsonElement record in records)
                {
                    result.Read++;
                    lines.AddRange(SilaPurchaseOrderRows.FromRecord(mappings, record, configuration.EntityCode, ref rowNumber));
                }

                // The first API that sends a purchase order owns it in this run.
                List<string> numbers = lines.Select(x => x.PoNumber?.Trim()).OfType<string>().Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                HashSet<string> mine = numbers.Where(number => taken.Add(number)).ToHashSet(StringComparer.OrdinalIgnoreCase);
                rows.AddRange(lines.Where(x => string.IsNullOrWhiteSpace(x.PoNumber) || mine.Contains(x.PoNumber.Trim())));
            }

            (List<SilaMasterImportRowDto> checkedRows, List<SilaPurchaseOrderSync.Plan> plans) =
                await SilaPurchaseOrderSync.CheckAsync(_repository, buyer.Id, rows, true, cancellationToken);
            string sourceSystem = configurations[0].SystemName ?? SilaPurchaseOrderSync.SOURCE_ERP;
            SilaPurchaseOrderSync.Apply(_repository, buyer, plans, sourceSystem);
            await _repository.SaveAsync();

            // Counted per purchase order, not per line.
            List<SilaMasterImportRowDto> perOrder = plans.Select(plan => new SilaMasterImportRowDto
            {
                RowNumber = plan.RowNumbers.Min(),
                Key = plan.PoNumber,
                Action = plan.Errors.Count > 0 ? SilaReceivingExcel.ACTION_INVALID : plan.Action,
                Errors = checkedRows.Where(row => plan.RowNumbers.Contains(row.RowNumber)).SelectMany(row => row.Errors).Distinct().Take(3).ToList()
            }).ToList();
            perOrder.AddRange(checkedRows.Where(row => row.Key.StartsWith('/')));
            SilaErpPull.Count(result, perOrder, ERROR_LIMIT);
            _logger.LogInfo($"Purchase orders pulled. Apis: {result.Apis}, Records: {result.Read}, Created: {result.Created}, Updated: {result.Updated}, Invalid: {result.Invalid}");
            return result;
        }
    }
}

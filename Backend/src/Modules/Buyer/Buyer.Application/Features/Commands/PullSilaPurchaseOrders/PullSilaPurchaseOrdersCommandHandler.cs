using System.Globalization;
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
    /// Reads GET_PO APIs. A filtered pull (company code + date range) prefers FIVE S4 - GET PO, checks the rows, and
    /// writes only after confirmation. A legacy pull with no body still reads every active GET_PO and writes immediately.
    /// </summary>
    public class PullSilaPurchaseOrdersCommandHandler : IRequestHandler<PullSilaPurchaseOrdersCommand, SilaMasterPullResultDto>
    {
        private const int ERROR_LIMIT = 50;
        private const int MAX_COMPANY_CODE_LENGTH = 20;
        private const string PREFERRED_GET_PO_NAME = "FIVE S4 - GET PO";

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
            bool commit = request.Request?.Commit ?? true;
            bool scoped = request.Request != null
                && (!string.IsNullOrWhiteSpace(request.Request.CompanyCode) || request.Request.FromDate != null || request.Request.ToDate != null);
            // Preview (commit false) always needs company + dates so the user confirms a known scope before any write.
            if (!commit || scoped)
            {
                scoped = true;
            }

            _logger.LogInfo(
                $"Pulling purchase orders from the ERP. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, Scoped: {scoped}, Commit: {commit}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<ApiIntegrationConfiguration> all = await SilaErpPull.ActiveConfigurationsAsync(
                _repository, request.OrganizationId, IntegrationProcessType.GET_PO, cancellationToken);
            if (all.Count == 0)
            {
                _logger.LogError($"No active purchase order API. OrganizationId: {request.OrganizationId}");
                throw new BadRequestCustomException("Purchase order API is not configured.", "Configure and activate a GET_PO API under Integration first.");
            }

            string? companyCode = null;
            string? odataFilter = null;
            List<ApiIntegrationConfiguration> configurations;
            if (scoped)
            {
                companyCode = request.Request?.CompanyCode?.Trim().ToUpperInvariant() ?? string.Empty;
                if (companyCode.Length == 0 || companyCode.Length > MAX_COMPANY_CODE_LENGTH)
                {
                    throw new BadRequestCustomException(
                        "Company code is required.",
                        $"Select the company code (at most {MAX_COMPANY_CODE_LENGTH} characters) whose purchase orders to pull.");
                }

                if (request.Request?.FromDate == null || request.Request.ToDate == null)
                {
                    throw new BadRequestCustomException("Date range is required.", "Choose the from and to order dates for the pull.");
                }

                DateTime fromDate = request.Request.FromDate.Value.Date;
                DateTime toDate = request.Request.ToDate.Value.Date;
                if (toDate < fromDate)
                {
                    throw new BadRequestCustomException("Date range is invalid.", "The to date must be on or after the from date.");
                }

                configurations = new List<ApiIntegrationConfiguration> { ResolveGetPo(all, companyCode) };
                odataFilter = BuildFilter(companyCode, fromDate, toDate);
            }
            else
            {
                // Legacy body-less pull: every active GET_PO, written immediately.
                configurations = all;
                commit = true;
            }

            SilaMasterPullResultDto result = new SilaMasterPullResultDto
            {
                Apis = configurations.Count,
                ConfigurationName = configurations.Count == 1 ? configurations[0].Name : null
            };
            List<SilaPoImportRowDto> rows = new List<SilaPoImportRowDto>();
            HashSet<string> taken = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            int rowNumber = 0;
            foreach (ApiIntegrationConfiguration configuration in configurations)
            {
                List<ApiFieldMapping> mappings = await _repository.ApiFieldMapping
                    .FindByCondition(x => x.ConfigurationId == configuration.Id && x.IsActive)
                    .ToListAsync(cancellationToken);
                if (mappings.Count == 0)
                {
                    _logger.LogError($"GET_PO has no field mappings. ConfigurationId: {configuration.Id}, Name: {configuration.Name}");
                    throw new BadRequestCustomException(
                        "Purchase order field mappings are missing.",
                        $"Map the ERP fields for {configuration.Name} under Integration (Po.Number, Po.SupplierCode, Po.Items.*) before pulling.");
                }

                List<JsonElement> records = await SilaErpPull.ReadAsync(
                    _executor, _logger, configuration, "purchase order", odataFilter, cancellationToken);
                List<SilaPoImportRowDto> lines = new List<SilaPoImportRowDto>();
                foreach (JsonElement record in records)
                {
                    result.Read++;
                    lines.AddRange(SilaPurchaseOrderRows.FromRecord(mappings, record, companyCode ?? configuration.EntityCode, ref rowNumber));
                }

                // The first API that sends a purchase order owns it in this run.
                List<string> numbers = lines.Select(x => x.PoNumber?.Trim()).OfType<string>().Distinct(StringComparer.OrdinalIgnoreCase).ToList();
                HashSet<string> mine = numbers.Where(number => taken.Add(number)).ToHashSet(StringComparer.OrdinalIgnoreCase);
                rows.AddRange(lines.Where(x => string.IsNullOrWhiteSpace(x.PoNumber) || mine.Contains(x.PoNumber.Trim())));
            }

            (List<SilaMasterImportRowDto> checkedRows, List<SilaPurchaseOrderSync.Plan> plans) =
                await SilaPurchaseOrderSync.CheckAsync(_repository, buyer.Id, rows, true, cancellationToken);

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

            if (commit)
            {
                string sourceSystem = configurations[0].SystemName ?? SilaPurchaseOrderSync.SOURCE_ERP;
                SilaPurchaseOrderSync.Apply(_repository, buyer, plans, sourceSystem);
                await _repository.SaveAsync();
                result.Committed = true;
            }

            _logger.LogInfo(
                $"Purchase orders {(result.Committed ? "pulled" : "previewed")}. Apis: {result.Apis}, Records: {result.Read}, Created: {result.Created}, Updated: {result.Updated}, Invalid: {result.Invalid}, Committed: {result.Committed}");
            return result;
        }

        /// <summary>Prefers FIVE S4 - GET PO for the company (or ALL), else the company match, else ALL.</summary>
        private static ApiIntegrationConfiguration ResolveGetPo(List<ApiIntegrationConfiguration> configurations, string companyCode)
        {
            ApiIntegrationConfiguration? named = configurations.FirstOrDefault(x =>
                x.Name.Equals(PREFERRED_GET_PO_NAME, StringComparison.OrdinalIgnoreCase)
                && (x.EntityCode.Equals(companyCode, StringComparison.OrdinalIgnoreCase)
                    || x.EntityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase)));
            if (named != null)
            {
                return named;
            }

            return configurations.FirstOrDefault(x => x.EntityCode.Equals(companyCode, StringComparison.OrdinalIgnoreCase))
                ?? configurations.FirstOrDefault(x => x.EntityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase))
                ?? configurations[0];
        }

        private static string BuildFilter(string companyCode, DateTime fromDate, DateTime toDate)
        {
            string company = companyCode.Replace("'", "''", StringComparison.Ordinal);
            string from = fromDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "T00:00:00";
            string to = toDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "T23:59:59";
            return $"CompanyCode eq '{company}' and PurchaseOrderDate ge datetime'{from}' and PurchaseOrderDate le datetime'{to}'";
        }
    }
}

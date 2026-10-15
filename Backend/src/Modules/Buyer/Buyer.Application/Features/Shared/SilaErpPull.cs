using System.Text.Json;
using Buyer.Domain.Dtos;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The ERP reads of the SILA ME receiving masters (GET_SUPPLIER, GET_PO): which APIs are read and how a failed read is
    /// reported. Records are written by <see cref="SilaSupplierSync"/> and <see cref="SilaPurchaseOrderSync"/>.
    /// </summary>
    public static class SilaErpPull
    {
        /// <summary>The organization's active APIs of the type, the organization-wide one (ALL) first, then by company code.</summary>
        public static async Task<List<ApiIntegrationConfiguration>> ActiveConfigurationsAsync(
            IRepositoryWrapper repository, Guid organizationId, IntegrationProcessType processType, CancellationToken cancellationToken)
        {
            string code = processType.ToString();
            List<ApiIntegrationConfiguration> configurations = await repository.ApiIntegrationConfiguration
                .FindByCondition(x => IntegrationLookup.BuyerIdsOf(repository, organizationId).Contains(x.BuyerId)
                    && x.ProcessType == code
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.IsActive)
                .ToListAsync(cancellationToken);
            return configurations
                .OrderBy(x => x.EntityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase) ? 0 : 1)
                .ThenBy(x => x.EntityCode)
                .ToList();
        }

        /// <summary>The records of one API; a failed call is a 424 that names the API.</summary>
        public static Task<List<JsonElement>> ReadAsync(
            IIntegrationHttpExecutor executor, ILoggerManager logger, ApiIntegrationConfiguration configuration, string what, CancellationToken cancellationToken)
        {
            return ReadAsync(executor, logger, configuration, what, null, cancellationToken);
        }

        /// <summary>
        /// The records of one API, optionally narrowed with an OData <c>$filter</c>. A failed call is a 424 that names the API.
        /// </summary>
        public static async Task<List<JsonElement>> ReadAsync(
            IIntegrationHttpExecutor executor,
            ILoggerManager logger,
            ApiIntegrationConfiguration configuration,
            string what,
            string? odataFilter,
            CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(odataFilter))
                {
                    return await executor.PullRecordsAsync(configuration, true, cancellationToken);
                }

                // Full sync for a filtered pull: ignore the watermark so the date/company filter alone scopes the read.
                DateTime? watermark = configuration.LastWatermark;
                configuration.LastWatermark = null;
                string url = AppendODataFilter(executor.BuildUrl(configuration, false), odataFilter.Trim());
                configuration.LastWatermark = watermark;
                string payload;
                using (HttpResponseMessage response = await executor.SendAsync(configuration, url, HttpMethod.Get, null, cancellationToken))
                {
                    if (!response.IsSuccessStatusCode)
                    {
                        throw new IntegrationException("REMOTE_HTTP_ERROR", $"The API returned HTTP {(int)response.StatusCode}.", 424);
                    }

                    payload = await response.Content.ReadAsStringAsync(cancellationToken);
                }

                return executor.ReadRecords(payload);
            }
            catch (IntegrationException exception)
            {
                logger.LogError($"ERP {what} API call failed. ConfigurationId: {configuration.Id}, Code: {exception.Code}, Error: {SilaLogText.Short(exception.Message)}");
                throw new FailedDependencyCustomException($"The {what} API {configuration.Name} could not be read.", $"{exception.Message} Nothing was changed.");
            }
        }

        /// <summary>Adds or merges an OData <c>$filter</c> on a URL that may already have a query string.</summary>
        public static string AppendODataFilter(string url, string filter)
        {
            string encoded = Uri.EscapeDataString(filter);
            int filterAt = url.IndexOf("$filter=", StringComparison.OrdinalIgnoreCase);
            if (filterAt < 0)
            {
                return url + (url.Contains('?') ? "&" : "?") + "$filter=" + encoded;
            }

            // Merge with an existing filter (e.g. watermark): (...existing...) and (extra).
            int valueStart = filterAt + "$filter=".Length;
            int valueEnd = url.IndexOf('&', valueStart);
            if (valueEnd < 0)
            {
                valueEnd = url.Length;
            }

            string existing = Uri.UnescapeDataString(url[valueStart..valueEnd]);
            string merged = $"({existing}) and ({filter})";
            return url[..valueStart] + Uri.EscapeDataString(merged) + url[valueEnd..];
        }

        /// <summary>Adds the row outcomes to the pull result, with the first errors.</summary>
        public static void Count(SilaMasterPullResultDto result, List<SilaMasterImportRowDto> rows, int errorLimit)
        {
            result.Created += rows.Count(x => x.Action == SilaReceivingExcel.ACTION_NEW);
            result.Updated += rows.Count(x => x.Action == SilaReceivingExcel.ACTION_UPDATE);
            result.Unchanged += rows.Count(x => x.Action == SilaReceivingExcel.ACTION_UNCHANGED);
            result.Invalid += rows.Count(x => x.Action == SilaReceivingExcel.ACTION_INVALID);
            foreach (SilaMasterImportRowDto row in rows.Where(x => x.Action == SilaReceivingExcel.ACTION_INVALID))
            {
                if (result.Errors.Count >= errorLimit)
                {
                    break;
                }

                result.Errors.Add($"Record {row.RowNumber}{(row.Key.Length > 0 ? $" ({row.Key})" : string.Empty)}: {string.Join(" ", row.Errors)}");
            }
        }
    }
}

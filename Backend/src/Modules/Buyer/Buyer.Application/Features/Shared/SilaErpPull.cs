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
            List<ApiIntegrationConfiguration> configurations = await repository.ApiIntegrationConfiguration
                .FindByCondition(x => IntegrationLookup.BuyerIdsOf(repository, organizationId).Contains(x.BuyerId)
                    && x.ProcessType == processType
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.IsActive)
                .ToListAsync(cancellationToken);
            return configurations
                .OrderBy(x => x.EntityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase) ? 0 : 1)
                .ThenBy(x => x.EntityCode)
                .ToList();
        }

        /// <summary>The records of one API; a failed call is a 424 that names the API.</summary>
        public static async Task<List<JsonElement>> ReadAsync(
            IIntegrationHttpExecutor executor, ILoggerManager logger, ApiIntegrationConfiguration configuration, string what, CancellationToken cancellationToken)
        {
            try
            {
                return await executor.PullRecordsAsync(configuration, true, cancellationToken);
            }
            catch (IntegrationException exception)
            {
                logger.LogError($"ERP {what} API call failed. ConfigurationId: {configuration.Id}, Code: {exception.Code}, Error: {SilaLogText.Short(exception.Message)}");
                throw new FailedDependencyCustomException($"The {what} API {configuration.Name} could not be read.", $"{exception.Message} Nothing was changed.");
            }
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

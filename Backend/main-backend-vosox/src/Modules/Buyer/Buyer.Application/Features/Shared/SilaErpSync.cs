using System.Text.Json;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// A manual or scheduled run (RunIntegration) of a GET_SUPPLIER or GET_PO API: the records are written into the Supplier
    /// Master or the ERP purchase orders, like "Pull from ERP" does, and counted on the execution. The run saves.
    /// </summary>
    public static class SilaErpSync
    {
        public static async Task ApplyAsync(
            IRepositoryWrapper repository, ApiIntegrationConfiguration configuration, List<ApiFieldMapping> mappings,
            List<JsonElement> records, ApiIntegrationExecution execution, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile? buyer = await repository.BuyerBusinessProfile
                .FindByCondition(x => x.OrganizationId == configuration.OrganizationId && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            execution.RecordsRead += records.Count;
            if (buyer == null)
            {
                execution.RecordsFailed += records.Count;
                execution.ErrorMessageSafe = "The organization has no buyer profile; nothing was written.";
                return;
            }

            List<SilaMasterImportRowDto> outcome;
            if (configuration.ProcessType == IntegrationProcessType.GET_SUPPLIER)
            {
                List<(int RowNumber, SilaSupplierWriteDto Supplier)> rows = new List<(int, SilaSupplierWriteDto)>();
                Dictionary<string, int> byCode = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                int number = 0;
                foreach (JsonElement record in records)
                {
                    number++;
                    SilaSupplierWriteDto supplier = SilaSupplierSync.FromRecord(mappings, record);
                    string code = supplier.SupplierCode.Trim();
                    if (code.Length > 0 && byCode.TryGetValue(code, out int position))
                    {
                        rows[position] = (number, supplier);
                        continue;
                    }

                    if (code.Length > 0)
                    {
                        byCode[code] = rows.Count;
                    }

                    rows.Add((number, supplier));
                }

                await SilaSupplierSync.KeepLocalFieldsAsync(repository, buyer.Id, rows, cancellationToken);
                outcome = await SilaSupplierSync.UpsertAsync(repository, buyer.Id, rows, true, cancellationToken);
            }
            else
            {
                List<SilaPoImportRowDto> lines = new List<SilaPoImportRowDto>();
                int rowNumber = 0;
                foreach (JsonElement record in records)
                {
                    lines.AddRange(SilaPurchaseOrderRows.FromRecord(mappings, record, configuration.EntityCode, ref rowNumber));
                }

                (List<SilaMasterImportRowDto> _, List<SilaPurchaseOrderSync.Plan> plans) =
                    await SilaPurchaseOrderSync.CheckAsync(repository, buyer.Id, lines, true, cancellationToken);
                SilaPurchaseOrderSync.Apply(repository, buyer, plans, configuration.SystemName ?? SilaPurchaseOrderSync.SOURCE_ERP);
                outcome = plans.Select(plan => new SilaMasterImportRowDto
                {
                    Key = plan.PoNumber,
                    Action = plan.Errors.Count > 0 ? SilaReceivingExcel.ACTION_INVALID : plan.Action
                }).ToList();
            }

            execution.RecordsCreated += outcome.Count(x => x.Action == SilaReceivingExcel.ACTION_NEW);
            execution.RecordsUpdated += outcome.Count(x => x.Action == SilaReceivingExcel.ACTION_UPDATE);
            int failed = outcome.Count(x => x.Action == SilaReceivingExcel.ACTION_INVALID);
            if (failed > 0)
            {
                execution.RecordsFailed += failed;
                execution.ErrorMessageSafe = $"{failed} record(s) were invalid and skipped (missing code, name, supplier or lines). Use Pull from ERP on the master screen to see the details.";
            }
        }
    }
}

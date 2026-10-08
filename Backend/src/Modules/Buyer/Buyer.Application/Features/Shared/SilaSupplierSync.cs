using System.Text.Json;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Writes a batch of suppliers (an Excel file or an ERP pull) into the Supplier Master: new codes are added, known
    /// codes are updated, deleted codes are brought back. Validation is per row; the caller decides what an invalid row means.
    /// </summary>
    public static class SilaSupplierSync
    {
        /// <summary>
        /// Classifies every row (NEW, UPDATE, UNCHANGED, INVALID) and, when <paramref name="write"/> is true, stages the
        /// valid rows on the repository (the caller saves).
        /// </summary>
        public static async Task<List<SilaMasterImportRowDto>> UpsertAsync(
            IRepositoryWrapper repository, Guid buyerId, List<(int RowNumber, SilaSupplierWriteDto Supplier)> rows, bool write, CancellationToken cancellationToken)
        {
            List<(int RowNumber, SilaSupplierWriteDto Supplier)> normalized = rows
                .Select(row => (row.RowNumber, SilaMasterDataRules.Normalize(row.Supplier)))
                .ToList();
            List<string> codes = normalized.Select(x => x.Item2.SupplierCode).Where(x => x.Length > 0).Distinct().ToList();
            Dictionary<string, SilaSupplier> existing = new Dictionary<string, SilaSupplier>(StringComparer.OrdinalIgnoreCase);
            foreach (string[] chunk in codes.Chunk(500))
            {
                List<SilaSupplier> found = await repository.SilaSupplier
                    .FindByCondition(x => x.BuyerId == buyerId && chunk.Contains(x.SupplierCode))
                    .ToListAsync(cancellationToken);
                foreach (SilaSupplier supplier in found)
                {
                    existing.TryAdd(supplier.SupplierCode, supplier);
                }
            }

            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            List<SilaMasterImportRowDto> result = new List<SilaMasterImportRowDto>();
            foreach ((int rowNumber, SilaSupplierWriteDto supplier) in normalized)
            {
                SilaMasterImportRowDto row = new SilaMasterImportRowDto
                {
                    RowNumber = rowNumber,
                    Key = supplier.SupplierCode,
                    Errors = SilaMasterDataRules.SupplierErrors(supplier)
                };
                if (supplier.SupplierCode.Length > 0 && !seen.Add(supplier.SupplierCode))
                {
                    row.Errors.Add($"Supplier code {supplier.SupplierCode} appears more than once.");
                }

                if (row.Errors.Count > 0)
                {
                    row.Action = SilaReceivingExcel.ACTION_INVALID;
                    result.Add(row);
                    continue;
                }

                if (existing.TryGetValue(supplier.SupplierCode, out SilaSupplier? current))
                {
                    // Untracked copy: changing it stages nothing until Update is called.
                    bool changed = SilaMasterDataRules.Apply(current, supplier);
                    row.Action = changed ? SilaReceivingExcel.ACTION_UPDATE : SilaReceivingExcel.ACTION_UNCHANGED;
                    if (write && changed)
                    {
                        repository.SilaSupplier.Update(current);
                    }
                }
                else
                {
                    row.Action = SilaReceivingExcel.ACTION_NEW;
                    if (write)
                    {
                        SilaSupplier created = new SilaSupplier { Id = Guid.NewGuid(), BuyerId = buyerId };
                        SilaMasterDataRules.Apply(created, supplier);
                        repository.SilaSupplier.Create(created);
                    }
                }

                result.Add(row);
            }

            return result;
        }

        /// <summary>The supplier of one ERP record (target fields Supplier.*). New suppliers are ACTIVE; a known one keeps its aliases and status.</summary>
        public static SilaSupplierWriteDto FromRecord(IReadOnlyList<ApiFieldMapping> mappings, JsonElement record)
        {
            return new SilaSupplierWriteDto
            {
                SupplierCode = IntegrationRecordReader.Read(mappings, "Supplier.Code", record) ?? string.Empty,
                Name = IntegrationRecordReader.Read(mappings, "Supplier.Name", record) ?? string.Empty,
                TaxNumber = IntegrationRecordReader.Read(mappings, "Supplier.TaxNumber", record),
                Country = IntegrationRecordReader.Read(mappings, "Supplier.Country", record),
                LegalName = IntegrationRecordReader.Read(mappings, "Supplier.LegalName", record),
                City = IntegrationRecordReader.Read(mappings, "Supplier.City", record),
                Address = IntegrationRecordReader.Read(mappings, "Supplier.Address", record),
                Currency = IntegrationRecordReader.Read(mappings, "Supplier.Currency", record)
            };
        }

        /// <summary>Keeps what the ERP does not send (aliases, status, network link) on suppliers that already exist.</summary>
        public static async Task KeepLocalFieldsAsync(IRepositoryWrapper repository, Guid buyerId, List<(int RowNumber, SilaSupplierWriteDto Supplier)> rows, CancellationToken cancellationToken)
        {
            List<string> codes = rows.Select(x => (x.Supplier.SupplierCode ?? string.Empty).Trim().ToUpperInvariant()).Where(x => x.Length > 0).Distinct().ToList();
            Dictionary<string, SilaSupplier> existing = new Dictionary<string, SilaSupplier>(StringComparer.OrdinalIgnoreCase);
            foreach (string[] chunk in codes.Chunk(500))
            {
                List<SilaSupplier> found = await repository.SilaSupplier
                    .FindByCondition(x => x.BuyerId == buyerId && chunk.Contains(x.SupplierCode))
                    .ToListAsync(cancellationToken);
                foreach (SilaSupplier supplier in found)
                {
                    existing.TryAdd(supplier.SupplierCode, supplier);
                }
            }

            foreach ((int _, SilaSupplierWriteDto supplier) in rows)
            {
                if (existing.TryGetValue((supplier.SupplierCode ?? string.Empty).Trim(), out SilaSupplier? current) && current.IsActive)
                {
                    supplier.Aliases = SilaMasterDataRules.SplitAliases(current.Aliases);
                    supplier.Status = current.Status;
                    supplier.SupplierOrganizationId = current.SupplierOrganizationId;

                    // Details the ERP does not send keep their local value.
                    supplier.LegalName ??= current.LegalName;
                    supplier.City ??= current.City;
                    supplier.Address ??= current.Address;
                    supplier.Currency ??= current.Currency;
                }
            }
        }
    }
}

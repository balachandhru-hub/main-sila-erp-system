using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Validates the rows of a material Excel import against the material master (batch lookups only) and builds the
    /// plan of what the import writes. Only existing materials are updated; a unit price becomes a price change request.
    /// </summary>
    public static class SilaMaterialImportValidator
    {
        public const string ACTION_CHANGE = "CHANGE";
        public const string ACTION_UNCHANGED = "UNCHANGED";
        public const string ACTION_CONVERSION = "CONVERSION";
        public const string ACTION_INVALID = "INVALID";
        private const int MAX_UOM_LENGTH = 20;
        private const int MAX_RESULT_ROWS = 500;

        public static async Task<SilaMaterialImportPlan> ValidateAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid buyerId,
            List<SilaMaterialExcelRow> materialRows,
            List<SilaConversionExcelRow> conversionRows,
            SilaMaterialImportPlan plan,
            CancellationToken cancellationToken)
        {
            List<string> codes = materialRows.Select(x => x.MaterialCode).Concat(conversionRows.Select(x => x.MaterialCode))
                .Where(x => x.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            List<ItemBuyerMaster> materials = await repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && codes.Contains(x.MaterialCode))
                .ToListAsync(cancellationToken);
            foreach (ItemBuyerMaster material in materials.Where(x => x.MaterialCode != null))
            {
                plan.Materials.TryAdd(material.MaterialCode.Trim(), material);
            }

            List<Guid> materialIds = plan.Materials.Values.Select(x => x.Id).ToList();
            List<MaterialUomConversion> existingConversions = await repository.MaterialUomConversion
                .FindByCondition(x => materialIds.Contains(x.MaterialId))
                .ToListAsync(cancellationToken);
            plan.Conversions = existingConversions.Where(x => x.IsActive).GroupBy(x => x.MaterialId).ToDictionary(x => x.Key, x => x.ToList());
            Dictionary<Guid, MaterialPriceChange> pending = await SilaMaterialRules.GetPendingChangesAsync(repository, buyerId, materialIds, cancellationToken);
            List<string> barcodes = materialRows.Where(x => !string.IsNullOrWhiteSpace(x.Fields.Barcode)).Select(x => x.Fields.Barcode!.Trim()).Distinct().ToList();
            List<ItemBuyerMaster> barcodeOwners = barcodes.Count == 0
                ? new List<ItemBuyerMaster>()
                : await repository.ItemBuyerMaster
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Barcode != null && barcodes.Contains(x.Barcode))
                    .ToListAsync(cancellationToken);

            List<SilaMaterialImportRowDto> rows = new List<SilaMaterialImportRowDto>();
            ValidateConversions(conversionRows, existingConversions, plan, rows);
            ValidateMaterials(logger, materialRows, barcodeOwners, pending, plan, rows);

            if (plan.PriceRows.Count > 0)
            {
                try
                {
                    ApprovalScope scope = await SilaMaterialPricing.GetScopeAsync(repository, buyerId, cancellationToken);
                    _ = await SilaApprovals.ResolveFlowAsync(repository, logger, buyerId, Common.SILA_APPROVAL_TYPE_MATERIAL_PRICE, scope, cancellationToken);
                }
                catch (BadRequestCustomException)
                {
                    plan.Result.FileErrors.Add(
                        $"The file requests {plan.PriceRows.Count} price change(s) but no approval flow of type {Common.SILA_APPROVAL_TYPE_MATERIAL_PRICE} exists. Create one in Approval Management first.");
                }
            }

            SilaMaterialImportResultDto result = plan.Result;
            result.TotalRows = rows.Count;
            result.InvalidRows = rows.Count(x => x.Action == ACTION_INVALID);
            result.ValidRows = result.TotalRows - result.InvalidRows;
            result.ChangedRows = rows.Count(x => x.Action == ACTION_CHANGE);
            result.UnchangedRows = rows.Count(x => x.Action == ACTION_UNCHANGED);
            result.PriceChanges = plan.PriceRows.Count;
            result.Conversions = plan.NewConversions.Count + plan.UpdatedConversions.Count;
            result.Rows = rows
                .OrderBy(x => x.Action == ACTION_INVALID ? 0 : 1)
                .ThenBy(x => x.Sheet)
                .ThenBy(x => x.RowNumber)
                .Take(MAX_RESULT_ROWS)
                .ToList();
            return plan;
        }

        private static void ValidateConversions(
            List<SilaConversionExcelRow> conversionRows,
            List<MaterialUomConversion> existing,
            SilaMaterialImportPlan plan,
            List<SilaMaterialImportRowDto> rows)
        {
            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (SilaConversionExcelRow row in conversionRows)
            {
                List<string> errors = new List<string>(row.Errors);
                ItemBuyerMaster? material = plan.Materials.TryGetValue(row.MaterialCode, out ItemBuyerMaster? found) ? found : null;
                if (material == null)
                {
                    errors.Add($"Material {row.MaterialCode} does not exist. Create it in Item Master or pull it from the ERP first.");
                }
                else
                {
                    string baseUom = UomConverter.BaseUomOf(material);
                    if (row.FromUom.Length == 0 || row.ToUom.Length == 0 || row.FromUom == row.ToUom)
                    {
                        errors.Add("Enter two different units of measure.");
                    }
                    else if (row.FromUom.Length > MAX_UOM_LENGTH || row.ToUom.Length > MAX_UOM_LENGTH)
                    {
                        errors.Add($"A unit of measure can have at most {MAX_UOM_LENGTH} characters.");
                    }
                    else if (row.FromUom != baseUom && row.ToUom != baseUom)
                    {
                        errors.Add($"Make {baseUom} (the base unit of {material.MaterialCode}) one of the two units.");
                    }

                    if (row.Factor <= 0)
                    {
                        errors.Add("Factor must be greater than zero.");
                    }

                    string pair = string.Join("|", material.Id, new[] { row.FromUom, row.ToUom }.OrderBy(x => x).First(), new[] { row.FromUom, row.ToUom }.OrderBy(x => x).Last());
                    if (errors.Count == 0 && !seen.Add(pair))
                    {
                        errors.Add("The same conversion appears twice in the file.");
                    }

                    if (errors.Count == 0)
                    {
                        PlanConversion(material, row, existing, plan);
                    }
                }

                rows.Add(new SilaMaterialImportRowDto
                {
                    Sheet = SilaMaterialExcel.CONVERSIONS_SHEET,
                    RowNumber = row.RowNumber,
                    MaterialCode = row.MaterialCode,
                    Action = errors.Count > 0 ? ACTION_INVALID : ACTION_CONVERSION,
                    Messages = errors.Count > 0 ? errors : new List<string> { $"1 {row.FromUom} = {row.Factor} {row.ToUom}" }
                });
            }
        }

        private static void PlanConversion(ItemBuyerMaster material, SilaConversionExcelRow row, List<MaterialUomConversion> existing, SilaMaterialImportPlan plan)
        {
            // One conversion per unit pair, whichever direction it was entered in; inactive rows are reused (unique index).
            MaterialUomConversion? conversion = existing.FirstOrDefault(x => x.MaterialId == material.Id &&
                ((x.FromUom == row.FromUom && x.ToUom == row.ToUom) || (x.FromUom == row.ToUom && x.ToUom == row.FromUom)));
            if (conversion == null)
            {
                conversion = new MaterialUomConversion
                {
                    Id = Guid.NewGuid(),
                    BuyerId = material.BuyerId,
                    MaterialId = material.Id,
                    IsActive = true
                };
                plan.NewConversions.Add(conversion);
            }
            else
            {
                plan.UpdatedConversions.Add(conversion);
            }

            conversion.FromUom = row.FromUom;
            conversion.ToUom = row.ToUom;
            conversion.Factor = row.Factor;
            conversion.IsActive = true;
            if (!plan.Conversions.TryGetValue(material.Id, out List<MaterialUomConversion>? list))
            {
                list = new List<MaterialUomConversion>();
                plan.Conversions[material.Id] = list;
            }

            if (!list.Contains(conversion))
            {
                list.Add(conversion);
            }
        }

        private static void ValidateMaterials(
            ILoggerManager logger,
            List<SilaMaterialExcelRow> materialRows,
            List<ItemBuyerMaster> barcodeOwners,
            Dictionary<Guid, MaterialPriceChange> pending,
            SilaMaterialImportPlan plan,
            List<SilaMaterialImportRowDto> rows)
        {
            HashSet<string> seenCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            Dictionary<string, string> barcodesInFile = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (SilaMaterialExcelRow row in materialRows)
            {
                List<string> errors = new List<string>(row.Errors);
                ItemBuyerMaster? material = plan.Materials.TryGetValue(row.MaterialCode, out ItemBuyerMaster? found) ? found : null;
                bool changed = false;
                bool priceChange = false;
                if (row.MaterialCode.Length > 0 && !seenCodes.Add(row.MaterialCode))
                {
                    errors.Add("The material appears twice in the Materials sheet.");
                }

                if (material == null)
                {
                    if (row.MaterialCode.Length > 0)
                    {
                        errors.Add($"Material {row.MaterialCode} does not exist. Create it in Item Master or pull it from the ERP first.");
                    }
                }
                else
                {
                    string? barcode = row.Fields.Barcode?.Trim();
                    if (!string.IsNullOrEmpty(barcode))
                    {
                        if (barcodeOwners.Any(x => x.Barcode == barcode && x.Id != material.Id)
                            || (barcodesInFile.TryGetValue(barcode, out string? owner) && owner != row.MaterialCode))
                        {
                            errors.Add($"Barcode {barcode} is already used by another material.");
                        }

                        barcodesInFile[barcode] = row.MaterialCode;
                    }

                    string before = Snapshot(material);
                    errors.AddRange(SilaMaterialRules.Apply(material, row.Fields));
                    changed = errors.Count == 0 && Snapshot(material) != before;
                    priceChange = CheckPrice(logger, row, material, pending, plan, errors);
                }

                if (errors.Count == 0)
                {
                    if (changed)
                    {
                        plan.ChangedMaterials.Add(material!);
                    }

                    if (priceChange)
                    {
                        plan.PriceRows.Add(row);
                    }
                }

                rows.Add(new SilaMaterialImportRowDto
                {
                    Sheet = SilaMaterialExcel.MATERIALS_SHEET,
                    RowNumber = row.RowNumber,
                    MaterialCode = row.MaterialCode,
                    Action = errors.Count > 0 ? ACTION_INVALID : changed || priceChange ? ACTION_CHANGE : ACTION_UNCHANGED,
                    PriceChange = errors.Count == 0 && priceChange,
                    Messages = errors.Count > 0
                        ? errors
                        : priceChange ? new List<string> { $"New unit price {row.NewUnitPrice} {row.Currency ?? material!.Currency} goes to approval." } : new List<string>()
                });
            }
        }

        /// <summary>True when the row asks for a price different from the approved one; problems go to errors.</summary>
        private static bool CheckPrice(
            ILoggerManager logger,
            SilaMaterialExcelRow row,
            ItemBuyerMaster material,
            Dictionary<Guid, MaterialPriceChange> pending,
            SilaMaterialImportPlan plan,
            List<string> errors)
        {
            if (row.NewUnitPrice == null)
            {
                return false;
            }

            List<string> priceErrors = SilaMaterialPricing.Validate(
                logger, material, plan.Conversions, row.NewUnitPrice.Value, row.Currency, row.PriceUom, row.PriceReason,
                out string currency, out string priceUom);
            bool same = priceErrors.Count == 0
                && material.UnitCost == row.NewUnitPrice
                && priceUom == UomConverter.BaseUomOf(material)
                && string.Equals(currency, material.Currency, StringComparison.OrdinalIgnoreCase);
            if (same)
            {
                return false;
            }

            if (pending.ContainsKey(material.Id))
            {
                priceErrors.Add($"A price change of {material.MaterialCode} is already waiting for approval; clear NewUnitPrice or wait for the decision.");
            }

            errors.AddRange(priceErrors);
            return priceErrors.Count == 0;
        }

        private static string Snapshot(ItemBuyerMaster material)
        {
            return string.Join("|", material.Barcode, material.IsInventoryItem, material.InventoryType, material.BatchManaged, material.ExpiryManaged,
                material.ShelfLifeDays, material.SerialManaged, material.StandardPrice, material.MovingAveragePrice);
        }
    }
}

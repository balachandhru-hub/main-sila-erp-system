using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Checks the rows of a location Excel file with the same rules as the location form (<see cref="SilaLocationRules.Check"/>).
    /// A row whose LocationCode exists updates that location, otherwise it creates one. Venues are checked first so stores and
    /// outlets of the same file can sit in them. The valid rows are applied to the context: the caller saves them only when
    /// no row is invalid (all or nothing).
    /// </summary>
    public static class SilaLocationImport
    {
        public const string ACTION_NEW = "NEW";
        public const string ACTION_UPDATE = "UPDATE";
        public const string ACTION_UNCHANGED = "UNCHANGED";
        public const string ACTION_INVALID = "INVALID";

        private const int MAX_PREVIEW_ROWS = 500;

        public static (List<SilaLocationImportRowDto> Rows, List<InventoryLocation> Created, List<InventoryLocation> Updated) Evaluate(
            List<(int RowNumber, Dictionary<string, string> Cells)> input, SilaLocationContext context, Guid buyerId)
        {
            List<SilaLocationImportRowDto> rows = new List<SilaLocationImportRowDto>();
            List<InventoryLocation> created = new List<InventoryLocation>();
            List<InventoryLocation> updated = new List<InventoryLocation>();
            HashSet<string> seen = new HashSet<string>();
            Dictionary<string, BuyerProperty> properties = context.Properties.Values
                .Where(x => !string.IsNullOrWhiteSpace(x.PlantCode))
                .GroupBy(x => x.PlantCode.Trim().ToUpperInvariant())
                .ToDictionary(x => x.Key, x => x.First());

            foreach ((int rowNumber, Dictionary<string, string> cells) in input.OrderBy(x => Cell(x.Cells, "LOCATIONTYPE").ToUpperInvariant() == Common.SILA_LOCATION_VENUE ? 0 : 1).ThenBy(x => x.RowNumber))
            {
                SilaLocationImportRowDto row = new SilaLocationImportRowDto
                {
                    RowNumber = rowNumber,
                    LocationCode = Cell(cells, "LOCATIONCODE").ToUpperInvariant(),
                    LocationName = Cell(cells, "LOCATIONNAME"),
                    LocationType = Cell(cells, "LOCATIONTYPE").ToUpperInvariant()
                };
                rows.Add(row);
                if (row.LocationCode.Length > 0 && !seen.Add(row.LocationCode))
                {
                    row.Errors.Add("The location code appears more than once in the file.");
                }

                InventoryLocation? existing = context.Locations.FirstOrDefault(x => x.LocationCode == row.LocationCode);
                if (existing != null && !existing.IsActive)
                {
                    row.Errors.Add("A deactivated location uses this code. Use another code.");
                }

                SilaLocationWriteDto write = ToWrite(row, cells, properties, context);
                if (row.Errors.Count == 0)
                {
                    SilaLocationIssue? issue = SilaLocationRules.Check(write, existing?.Id, context);
                    if (issue != null)
                    {
                        row.Errors.Add($"{issue.Message} {issue.Description}");
                    }
                }

                if (row.Errors.Count > 0)
                {
                    row.Action = ACTION_INVALID;
                    continue;
                }

                if (existing == null)
                {
                    InventoryLocation location = new InventoryLocation { Id = Guid.NewGuid(), BuyerId = buyerId, IsActive = true };
                    SilaLocationRules.Apply(location, write);
                    context.Locations.Add(location);
                    created.Add(location);
                    row.Action = ACTION_NEW;
                }
                else if (Same(existing, write))
                {
                    row.Action = ACTION_UNCHANGED;
                }
                else
                {
                    SilaLocationRules.Apply(existing, write);
                    updated.Add(existing);
                    row.Action = ACTION_UPDATE;
                }
            }

            return (rows.OrderBy(x => x.RowNumber).ToList(), created, updated);
        }

        /// <summary>The preview counts and rows (invalid rows first, at most 500 rows).</summary>
        public static SilaLocationImportPreviewDto ToPreview(string fileName, List<SilaLocationImportRowDto> rows, List<string> fileErrors)
        {
            return new SilaLocationImportPreviewDto
            {
                FileName = fileName,
                TotalRows = rows.Count,
                NewRows = rows.Count(x => x.Action == ACTION_NEW),
                UpdateRows = rows.Count(x => x.Action == ACTION_UPDATE),
                UnchangedRows = rows.Count(x => x.Action == ACTION_UNCHANGED),
                InvalidRows = rows.Count(x => x.Action == ACTION_INVALID),
                FileErrors = fileErrors,
                Rows = rows.OrderBy(x => x.Action == ACTION_INVALID ? 0 : 1).ThenBy(x => x.RowNumber).Take(MAX_PREVIEW_ROWS).ToList()
            };
        }

        private static SilaLocationWriteDto ToWrite(
            SilaLocationImportRowDto row, Dictionary<string, string> cells, Dictionary<string, BuyerProperty> properties, SilaLocationContext context)
        {
            SilaLocationWriteDto write = new SilaLocationWriteDto
            {
                LocationCode = row.LocationCode,
                LocationName = row.LocationName,
                LocationType = row.LocationType,
                StoreCategory = Cell(cells, "STORECATEGORY"),
                StorageLocationCode = Cell(cells, "STORAGELOCATIONCODE"),
                GlAccount = Cell(cells, "GLACCOUNT"),
                CostCenter = Cell(cells, "COSTCENTER"),
                ProfitCenter = Cell(cells, "PROFITCENTER"),
                TransferEnabled = Flag(cells, "TRANSFERENABLED", true, row.Errors),
                SalesEnabled = Flag(cells, "SALESENABLED", row.LocationType == Common.SILA_LOCATION_OUTLET, row.Errors)
            };

            string propertyCode = Cell(cells, "PROPERTYCODE").ToUpperInvariant();
            if (!properties.TryGetValue(propertyCode, out BuyerProperty? property))
            {
                row.Errors.Add(propertyCode.Length == 0 ? "PropertyCode is required." : $"No property has the plant code {propertyCode}.");
                return write;
            }

            write.PropertyId = property.Id;
            string venueCode = Cell(cells, "PARENTVENUECODE").ToUpperInvariant();
            if (venueCode.Length > 0)
            {
                InventoryLocation? venue = context.Locations.FirstOrDefault(x => x.IsActive && x.LocationCode == venueCode && x.LocationType == Common.SILA_LOCATION_VENUE);
                if (venue == null)
                {
                    row.Errors.Add($"No active venue has the code {venueCode}.");
                }
                else
                {
                    write.ParentLocationId = venue.Id;
                }
            }

            string outletCode = Cell(cells, "OUTLETCODE");
            if (outletCode.Length > 0)
            {
                BuyerOutlet? outlet = context.Outlets.FirstOrDefault(x => x.PropertyId == property.Id
                        && string.Equals(x.OutletCode?.Trim(), outletCode, StringComparison.OrdinalIgnoreCase))
                    ?? context.Outlets.FirstOrDefault(x => x.PropertyId == property.Id
                        && string.Equals(x.OutletName.Trim(), outletCode, StringComparison.OrdinalIgnoreCase));
                if (outlet == null)
                {
                    row.Errors.Add($"No outlet of property {propertyCode} has the code {outletCode}.");
                }
                else
                {
                    write.OutletId = outlet.Id;
                }
            }

            return write;
        }

        private static bool Same(InventoryLocation location, SilaLocationWriteDto write)
        {
            return location.PropertyId == write.PropertyId
                && location.LocationName == write.LocationName
                && location.LocationType == write.LocationType
                && location.OutletId == write.OutletId
                && location.StoreCategory == write.StoreCategory
                && location.StorageLocationCode == write.StorageLocationCode
                && location.TransferEnabled == write.TransferEnabled
                && location.SalesEnabled == write.SalesEnabled
                && location.ParentLocationId == write.ParentLocationId
                && location.GlAccount == write.GlAccount
                && location.CostCenter == write.CostCenter
                && location.ProfitCenter == write.ProfitCenter;
        }

        private static string Cell(Dictionary<string, string> cells, string column)
        {
            return cells.TryGetValue(column, out string? value) ? value.Trim() : string.Empty;
        }

        private static bool Flag(Dictionary<string, string> cells, string column, bool fallback, List<string> errors)
        {
            string value = Cell(cells, column).ToUpperInvariant();
            if (value.Length == 0)
            {
                return fallback;
            }

            if (value is "Y" or "YES" or "TRUE" or "1")
            {
                return true;
            }

            if (value is "N" or "NO" or "FALSE" or "0")
            {
                return false;
            }

            errors.Add($"{column} must be Y or N.");
            return fallback;
        }
    }
}

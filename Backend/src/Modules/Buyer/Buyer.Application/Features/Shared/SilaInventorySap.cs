using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.Integration;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// One SAP stock-posting decision for internal transfers, recipe/POS consumption, stock-count variances and
    /// adjustments. The four API names already exist in Integration Settings. Nothing here chooses another API.
    /// </summary>
    public static class SilaInventorySap
    {
        public const string API_TRANSFER = "FIVE S4 - Transfer Stock";
        public const string API_PLANT_TRANSFER = "FIVE S4 - Plant Transfer Stock";
        public const string API_GOODS_ISSUE = "FIVE S4 - Goods Issue";
        public const string API_POSITIVE_ADJUSTMENT = "FIVE S4 - Positive Stock Adjustment";

        public const string CODE_TRANSFER = "04";
        public const string CODE_ISSUE = "03";
        public const string TYPE_311 = "311";
        public const string TYPE_301 = "301";
        public const string TYPE_Z02 = "Z02";
        public const string TYPE_Z01 = "Z01";

        public const string SOURCE_SAP_LOCATION_MAPPING_MISSING = "SOURCE_SAP_LOCATION_MAPPING_MISSING";
        public const string DESTINATION_SAP_LOCATION_MAPPING_MISSING = "DESTINATION_SAP_LOCATION_MAPPING_MISSING";
        public const string INVENTORY_LOCATION_MAPPING_MISSING = "INVENTORY_LOCATION_MAPPING_MISSING";
        public const string INVALID_TRANSFER_LOCATION = "INVALID_TRANSFER_LOCATION";
        public const string CROSS_COMPANY_TRANSFER_NOT_CONFIGURED = "CROSS_COMPANY_TRANSFER_NOT_CONFIGURED";
        public const string UOM_CONVERSION_MISSING = "UOM_CONVERSION_MISSING";
        public const string MATERIAL_MAPPING_MISSING = "MATERIAL_MAPPING_MISSING";
        public const string MATERIAL_NOT_VALID = "MATERIAL_NOT_VALID";
        public const string SAP_API_CONFIGURATION_NOT_FOUND = "SAP_API_CONFIGURATION_NOT_FOUND";
        public const string ALREADY_POSTED = "ALREADY_POSTED";

        public static readonly Rule SamePlantTransfer = new Rule(API_TRANSFER, CODE_TRANSFER, TYPE_311, false);
        public static readonly Rule PlantTransfer = new Rule(API_PLANT_TRANSFER, CODE_TRANSFER, TYPE_301, true);
        public static readonly Rule GoodsIssue = new Rule(API_GOODS_ISSUE, CODE_ISSUE, TYPE_Z02, false);
        public static readonly Rule PositiveAdjustment = new Rule(API_POSITIVE_ADJUSTMENT, CODE_ISSUE, TYPE_Z01, false);

        /// <summary>OUT consumes or reduces stock (Z02). IN returns or increases stock (Z01).</summary>
        public static Rule ForDirection(string? direction)
        {
            return direction == Common.SILA_DIRECTION_IN ? PositiveAdjustment : GoodsIssue;
        }

        /// <summary>A POS sale keeps its movement once queued. Older rows are read from the sold-quantity sign.</summary>
        public static string MovementForSale(string? movementType, decimal quantitySold)
        {
            if (movementType == TYPE_Z01 || movementType == TYPE_Z02)
            {
                return movementType;
            }

            return quantitySold < 0 ? TYPE_Z01 : TYPE_Z02;
        }

        public static string MovementForDirection(string? direction)
        {
            return ForDirection(direction).GoodsMovementType;
        }

        /// <summary>
        /// Null when the locations can be posted. Same plant and a different storage location is 311.
        /// A different plant in the same company is 301. A different company stops.
        /// </summary>
        public static string? DecideTransfer(
            string? fromPlant,
            string? fromStorage,
            string? toPlant,
            string? toStorage,
            string? fromCompany,
            string? toCompany,
            out Rule? rule)
        {
            rule = null;
            if (string.IsNullOrWhiteSpace(fromPlant) || string.IsNullOrWhiteSpace(fromStorage))
            {
                return SOURCE_SAP_LOCATION_MAPPING_MISSING;
            }

            if (string.IsNullOrWhiteSpace(toPlant) || string.IsNullOrWhiteSpace(toStorage))
            {
                return DESTINATION_SAP_LOCATION_MAPPING_MISSING;
            }

            bool companiesKnown = !string.IsNullOrWhiteSpace(fromCompany) && !string.IsNullOrWhiteSpace(toCompany);
            if (companiesKnown && !Same(fromCompany!, toCompany!))
            {
                return CROSS_COMPANY_TRANSFER_NOT_CONFIGURED;
            }

            if (!Same(fromPlant, toPlant))
            {
                if (!companiesKnown)
                {
                    return CROSS_COMPANY_TRANSFER_NOT_CONFIGURED;
                }

                rule = PlantTransfer;
                return null;
            }

            if (Same(fromStorage, toStorage))
            {
                return INVALID_TRANSFER_LOCATION;
            }

            rule = SamePlantTransfer;
            return null;
        }

        public static string? EntryUnitOf(string? baseUnitOfMeasure)
        {
            string unit = (baseUnitOfMeasure ?? string.Empty).Trim();
            return unit.Length == 0 ? null : unit;
        }

        public static string FormatQuantity(decimal quantity)
        {
            if (quantity <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(quantity), "QuantityInEntryUnit must be positive.");
            }

            return quantity.ToString("0.000################", CultureInfo.InvariantCulture);
        }

        public static string FormatDate(DateTime value)
        {
            return value.Date.ToString("yyyy-MM-dd'T'00:00:00", CultureInfo.InvariantCulture);
        }

        public static string Describe(string code)
        {
            return code switch
            {
                SOURCE_SAP_LOCATION_MAPPING_MISSING => "The source location has no SAP plant or storage location.",
                DESTINATION_SAP_LOCATION_MAPPING_MISSING => "The destination location has no SAP plant or storage location.",
                INVENTORY_LOCATION_MAPPING_MISSING => "The inventory location has no SAP plant or storage location.",
                INVALID_TRANSFER_LOCATION => "The source and destination storage locations are the same.",
                CROSS_COMPANY_TRANSFER_NOT_CONFIGURED => "The source and destination company codes differ, so this transfer is not posted.",
                UOM_CONVERSION_MISSING => "The material has no SAP unit of measure, or the quantity cannot be converted to it.",
                MATERIAL_MAPPING_MISSING => "The material is not an active stock item with a material number.",
                MATERIAL_NOT_VALID => "The material is not an active stock item.",
                SAP_API_CONFIGURATION_NOT_FOUND => "The SAP API for this stock movement is not active. No other API is used.",
                ALREADY_POSTED => "This stock movement already has an SAP material document.",
                _ => "The stock movement cannot be posted."
            };
        }

        public static string Failure(string code)
        {
            return code + ". " + Describe(code);
        }

        public static string MissingApi(string apiName)
        {
            return SAP_API_CONFIGURATION_NOT_FOUND + ". Activate " + apiName + ". No other API is used.";
        }

        /// <summary>One transfer, one material document. 311 stays in the source plant. 301 names the receiving plant.</summary>
        public static string? TryBuildTransfer(
            DateTime businessDate,
            string? fromPlant,
            string? fromStorage,
            string? toPlant,
            string? toStorage,
            string? fromCompany,
            string? toCompany,
            IReadOnlyList<TransferLine> lines,
            Dictionary<Guid, List<MaterialUomConversion>> conversions,
            out string? body,
            out Rule? rule)
        {
            body = null;
            string? problem = DecideTransfer(fromPlant, fromStorage, toPlant, toStorage, fromCompany, toCompany, out rule);
            if (problem != null || rule == null)
            {
                return problem;
            }

            string sourcePlant = fromPlant!.Trim();
            string sourceStorage = fromStorage!.Trim();
            string destinationPlant = toPlant!.Trim();
            string destinationStorage = toStorage!.Trim();
            List<TransferQuantity> ready = new List<TransferQuantity>();
            foreach (TransferLine line in lines.OrderBy(x => x.Material.MaterialCode))
            {
                if (line.Quantity <= 0)
                {
                    continue;
                }

                string? convertedProblem = ConvertLine(line.Material, line.Quantity, line.QuantityUom, conversions, out string material, out string unit, out decimal quantity);
                if (convertedProblem != null)
                {
                    return convertedProblem;
                }

                ready.Add(new TransferQuantity(material, unit, quantity));
            }

            if (ready.Count == 0)
            {
                rule = null;
                return null;
            }

            string postingDate = FormatDate(businessDate);
            Rule decided = rule;
            if (decided.ReceivingPlant)
            {
                body = JsonSerializer.Serialize(new
                {
                    PostingDate = postingDate,
                    DocumentDate = postingDate,
                    GoodsMovementCode = decided.GoodsMovementCode,
                    to_MaterialDocumentItem = ready.Select(line => new
                    {
                        Material = line.Material,
                        Plant = sourcePlant,
                        StorageLocation = sourceStorage,
                        GoodsMovementType = decided.GoodsMovementType,
                        QuantityInEntryUnit = FormatQuantity(line.Quantity),
                        EntryUnit = line.EntryUnit,
                        IssuingOrReceivingPlant = destinationPlant,
                        IssuingOrReceivingStorageLoc = destinationStorage
                    }).ToList()
                });
            }
            else
            {
                body = JsonSerializer.Serialize(new
                {
                    PostingDate = postingDate,
                    DocumentDate = postingDate,
                    GoodsMovementCode = decided.GoodsMovementCode,
                    to_MaterialDocumentItem = ready.Select(line => new
                    {
                        Material = line.Material,
                        Plant = sourcePlant,
                        StorageLocation = sourceStorage,
                        GoodsMovementType = decided.GoodsMovementType,
                        QuantityInEntryUnit = FormatQuantity(line.Quantity),
                        EntryUnit = line.EntryUnit,
                        IssuingOrReceivingStorageLoc = destinationStorage
                    }).ToList()
                });
            }

            return null;
        }

        /// <summary>
        /// Goods issue or positive adjustment. Compatible lines (same material and SAP unit) are summed.
        /// The quantity is always positive.
        /// </summary>
        public static string? TryBuildEffect(
            DateTime businessDate,
            string? plant,
            string? storageLocation,
            Rule rule,
            IReadOnlyList<TransferLine> lines,
            Dictionary<Guid, List<MaterialUomConversion>> conversions,
            out string? body)
        {
            body = null;
            if (string.IsNullOrWhiteSpace(plant) || string.IsNullOrWhiteSpace(storageLocation))
            {
                return INVENTORY_LOCATION_MAPPING_MISSING;
            }

            string sapPlant = plant.Trim();
            string sapStorage = storageLocation.Trim();
            Dictionary<string, decimal> totals = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
            Dictionary<string, (string Material, string Unit)> keys = new Dictionary<string, (string, string)>(StringComparer.OrdinalIgnoreCase);
            foreach (TransferLine line in lines)
            {
                if (line.Quantity <= 0)
                {
                    continue;
                }

                string? convertedProblem = ConvertLine(line.Material, line.Quantity, line.QuantityUom, conversions, out string material, out string unit, out decimal quantity);
                if (convertedProblem != null)
                {
                    return convertedProblem == MATERIAL_NOT_VALID ? MATERIAL_MAPPING_MISSING : convertedProblem;
                }

                string key = material + "|" + unit;
                totals[key] = totals.GetValueOrDefault(key) + quantity;
                keys[key] = (material, unit);
            }

            if (totals.Count == 0)
            {
                return null;
            }

            string postingDate = FormatDate(businessDate);
            body = JsonSerializer.Serialize(new
            {
                PostingDate = postingDate,
                DocumentDate = postingDate,
                GoodsMovementCode = rule.GoodsMovementCode,
                to_MaterialDocumentItem = totals
                    .OrderBy(x => x.Key, StringComparer.OrdinalIgnoreCase)
                    .Select(x => new
                    {
                        Plant = sapPlant,
                        StorageLocation = sapStorage,
                        Material = keys[x.Key].Material,
                        GoodsMovementType = rule.GoodsMovementType,
                        QuantityInEntryUnit = FormatQuantity(x.Value),
                        EntryUnit = keys[x.Key].Unit
                    })
                    .ToList()
            });
            return null;
        }

        public static string? ReadMaterialDocument(string? payload)
        {
            if (string.IsNullOrWhiteSpace(payload))
            {
                return null;
            }

            try
            {
                using JsonDocument json = JsonDocument.Parse(payload);
                JsonElement root = json.RootElement;
                if (root.ValueKind == JsonValueKind.Object
                    && root.TryGetProperty("d", out JsonElement wrapped)
                    && wrapped.ValueKind == JsonValueKind.Object)
                {
                    root = wrapped;
                }

                if (root.ValueKind != JsonValueKind.Object)
                {
                    return null;
                }

                string? number = Text(root, "MaterialDocument")
                    ?? Text(root, "materialDocument")
                    ?? Text(root, "materialDocumentNumber");
                if (string.IsNullOrWhiteSpace(number))
                {
                    return null;
                }

                string? year = Text(root, "MaterialDocumentYear") ?? Text(root, "materialDocumentYear");
                return string.IsNullOrWhiteSpace(year) ? number : number + "/" + year;
            }
            catch (JsonException)
            {
                return null;
            }
        }

        /// <summary>True when this movement's material document was already stored on the posting.</summary>
        public static bool ReferenceHas(string? erpReference, string movementType)
        {
            if (string.IsNullOrWhiteSpace(erpReference))
            {
                return false;
            }

            return erpReference.Contains(movementType + ":", StringComparison.OrdinalIgnoreCase);
        }

        public static string JoinReference(string? existing, string movementType, string document)
        {
            string piece = movementType + ":" + document;
            if (string.IsNullOrWhiteSpace(existing))
            {
                return piece;
            }

            if (existing.Contains(piece, StringComparison.OrdinalIgnoreCase))
            {
                return existing;
            }

            return existing + "; " + piece;
        }

        /// <summary>The named active API for the company code, otherwise ALL. No other API is returned.</summary>
        public static async Task<ApiIntegrationConfiguration?> ResolveAsync(
            IRepositoryWrapper repository,
            Guid organizationId,
            string apiName,
            string? companyCode,
            CancellationToken cancellationToken)
        {
            List<ApiIntegrationConfiguration> named = await repository.ApiIntegrationConfiguration
                .FindByCondition(x => IntegrationLookup.BuyerIdsOf(repository, organizationId).Contains(x.BuyerId)
                    && x.IsActive
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.Name == apiName)
                .ToListAsync(cancellationToken);
            return named.FirstOrDefault(x => companyCode != null && x.EntityCode.Equals(companyCode, StringComparison.OrdinalIgnoreCase))
                ?? named.FirstOrDefault(x => x.EntityCode.Equals(IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase))
                ?? (companyCode == null ? named.OrderBy(x => x.DateCreated).FirstOrDefault() : null);
        }

        private static string? ConvertLine(
            ItemBuyerMaster material,
            decimal quantity,
            string? quantityUom,
            Dictionary<Guid, List<MaterialUomConversion>> conversions,
            out string materialCode,
            out string entryUnit,
            out decimal converted)
        {
            materialCode = string.Empty;
            entryUnit = string.Empty;
            converted = 0;
            if (!material.IsActive || !SilaMaterialRules.HoldsStock(material) || string.IsNullOrWhiteSpace(material.MaterialCode))
            {
                return MATERIAL_NOT_VALID;
            }

            string? unit = EntryUnitOf(material.BaseUnitOfMeasure);
            if (unit == null)
            {
                return UOM_CONVERSION_MISSING;
            }

            decimal? baseQuantity = UomConverter.TryToBase(material, quantity, quantityUom, conversions);
            if (baseQuantity == null || baseQuantity.Value <= 0)
            {
                return UOM_CONVERSION_MISSING;
            }

            materialCode = material.MaterialCode.Trim();
            entryUnit = unit;
            converted = baseQuantity.Value;
            return null;
        }

        private static string? Text(JsonElement root, string name)
        {
            if (!root.TryGetProperty(name, out JsonElement value) || value.ValueKind is not (JsonValueKind.String or JsonValueKind.Number))
            {
                return null;
            }

            string text = value.ToString();
            return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        }

        private static bool Same(string left, string right)
        {
            return string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);
        }

        public sealed class Rule
        {
            public Rule(string apiName, string goodsMovementCode, string goodsMovementType, bool receivingPlant)
            {
                ApiName = apiName;
                GoodsMovementCode = goodsMovementCode;
                GoodsMovementType = goodsMovementType;
                ReceivingPlant = receivingPlant;
            }

            public string ApiName { get; }
            public string GoodsMovementCode { get; }
            public string GoodsMovementType { get; }
            public bool ReceivingPlant { get; }
        }

        public readonly record struct TransferLine(ItemBuyerMaster Material, decimal Quantity, string? QuantityUom);

        private readonly record struct TransferQuantity(string Material, string EntryUnit, decimal Quantity);
    }
}

using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
        /// <summary>
        /// Internal transfer posted through <see cref="SilaInventorySap"/>. Same plant is 311. A different plant in the
        /// same company is 301. The user does not choose the movement. One transfer is one material document.
        /// </summary>
    public static class SilaTransferSap
    {
        public const string API_CONFIG_NAME = "FIVE S4 - Transfer Stock";
        public const string GOODS_MOVEMENT_CODE = "04";
        public const string GOODS_MOVEMENT_TYPE = "311";

        public const string SOURCE_SAP_LOCATION_MAPPING_MISSING = "SOURCE_SAP_LOCATION_MAPPING_MISSING";
        public const string DESTINATION_SAP_LOCATION_MAPPING_MISSING = "DESTINATION_SAP_LOCATION_MAPPING_MISSING";
        public const string INVALID_TRANSFER_LOCATION = "INVALID_TRANSFER_LOCATION";
        public const string CROSS_COMPANY_TRANSFER_NOT_CONFIGURED = SilaInventorySap.CROSS_COMPANY_TRANSFER_NOT_CONFIGURED;
        public const string UOM_CONVERSION_MISSING = "UOM_CONVERSION_MISSING";
        public const string TRANSFER_API_NOT_CONFIGURED = "TRANSFER_API_NOT_CONFIGURED";
        public const string TRANSFER_ALREADY_POSTED = "TRANSFER_ALREADY_POSTED";
        public const string MATERIAL_NOT_VALID = "MATERIAL_NOT_VALID";

        /// <summary>Dispatch, receipt and a short receipt have already moved stock. Approval has not.</summary>
        public static bool MovesStock(string? status)
        {
            return status == Common.SILA_ITO_DISPATCHED
                || status == Common.SILA_ITO_RECEIVED
                || status == Common.SILA_ITO_DISCREPANCY;
        }

        /// <summary>
        /// Null when the locations can be posted. Plant comes from the property. Storage location comes from the
        /// inventory location. A different company code is refused.
        /// </summary>
        public static string? LocationProblem(
            string? fromPlant, string? fromStorage, string? toPlant, string? toStorage, string? fromCompany = null, string? toCompany = null)
        {
            return SilaInventorySap.DecideTransfer(fromPlant, fromStorage, toPlant, toStorage, fromCompany, toCompany, out _);
        }

        /// <summary>The material's own base unit. Blank is missing; it is not replaced with a default unit.</summary>
        public static string? EntryUnitOf(string? baseUnitOfMeasure)
        {
            string unit = (baseUnitOfMeasure ?? string.Empty).Trim();
            return unit.Length == 0 ? null : unit;
        }

        /// <summary>A positive quantity with at least three decimals and no sign. 0.400 stays 0.400.</summary>
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
                INVALID_TRANSFER_LOCATION => "The source and destination storage locations are the same.",
                CROSS_COMPANY_TRANSFER_NOT_CONFIGURED => SilaInventorySap.Describe(CROSS_COMPANY_TRANSFER_NOT_CONFIGURED),
                UOM_CONVERSION_MISSING => "The material has no SAP unit of measure, or the quantity cannot be converted to it.",
                TRANSFER_API_NOT_CONFIGURED => "FIVE S4 - Transfer Stock is not an active integration. Activate that API. No other API is used.",
                TRANSFER_ALREADY_POSTED => "This transfer already has an SAP material document.",
                MATERIAL_NOT_VALID => "The material is not an active stock item.",
                _ => "The transfer cannot be posted."
            };
        }

        public static string Failure(string code)
        {
            return code + ". " + Describe(code);
        }

        /// <summary>
        /// The material document for one transfer. Every positive line is an item. The configured example body is not used.
        /// Returns the error code, or null when <paramref name="body"/> is the request.
        /// </summary>
        public static string? TryBuildBody(
            InternalTransferOrder transfer,
            InventoryLocation? from,
            InventoryLocation? to,
            BuyerProperty? fromProperty,
            BuyerProperty? toProperty,
            IReadOnlyList<InternalTransferOrderItem> items,
            IReadOnlyDictionary<Guid, ItemBuyerMaster> materials,
            Dictionary<Guid, List<MaterialUomConversion>> conversions,
            out string? body)
        {
            return TryPrepare(transfer, from, to, fromProperty, toProperty, items, materials, conversions, out body, out _);
        }

        /// <summary>The request and the API rule (311 or 301). A null body with a null error means there is no quantity.</summary>
        public static string? TryPrepare(
            InternalTransferOrder transfer,
            InventoryLocation? from,
            InventoryLocation? to,
            BuyerProperty? fromProperty,
            BuyerProperty? toProperty,
            IReadOnlyList<InternalTransferOrderItem> items,
            IReadOnlyDictionary<Guid, ItemBuyerMaster> materials,
            Dictionary<Guid, List<MaterialUomConversion>> conversions,
            out string? body,
            out SilaInventorySap.Rule? rule)
        {
            List<SilaInventorySap.TransferLine> lines = new List<SilaInventorySap.TransferLine>();
            foreach (InternalTransferOrderItem item in items)
            {
                decimal quantity = item.DispatchedQty > 0 ? item.DispatchedQty : item.ApprovedQty;
                if (quantity <= 0)
                {
                    continue;
                }

                if (!materials.TryGetValue(item.MaterialId, out ItemBuyerMaster? material))
                {
                    body = null;
                    rule = null;
                    return MATERIAL_NOT_VALID;
                }

                lines.Add(new SilaInventorySap.TransferLine(material, quantity, item.Uom));
            }

            string? problem = SilaInventorySap.TryBuildTransfer(
                transfer.DispatchedOn ?? DateTime.UtcNow,
                fromProperty?.PlantCode,
                from?.StorageLocationCode,
                toProperty?.PlantCode,
                to?.StorageLocationCode,
                fromProperty?.CompanyCode,
                toProperty?.CompanyCode,
                lines,
                conversions,
                out body,
                out rule);
            return problem == SilaInventorySap.MATERIAL_NOT_VALID ? MATERIAL_NOT_VALID : problem;
        }

        /// <summary>Material document number, with the year when SAP returned it (stored in the existing reference field).</summary>
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

        /// <summary>
        /// Queues one PENDING posting for the transfer after the ledger movement and before the command saves.
        /// A transfer that already has a posting is not queued again. Stock quantities are not changed here.
        /// </summary>
        public static async Task QueueAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            InventoryLedger ledger,
            InternalTransferOrder transfer,
            IReadOnlyList<InternalTransferOrderItem> items,
            Guid organizationId,
            CancellationToken cancellationToken)
        {
            if (!MovesStock(transfer.Status))
            {
                return;
            }

            List<InventoryErpPosting> existing = await repository.InventoryErpPosting
                .FindByCondition(x => x.BuyerId == transfer.BuyerId && x.IsActive
                    && x.ReferenceType == Common.SILA_REF_ITO && x.ReferenceId == transfer.Id)
                .ToListAsync(cancellationToken);
            if (existing.Any(x => x.Status == Common.SILA_POSTING_POSTED))
            {
                logger.LogError($"Transfer already posted to SAP. TransferId: {transfer.Id}, ItoNumber: {transfer.ItoNumber}");
                throw new BadRequestCustomException(TRANSFER_ALREADY_POSTED, Describe(TRANSFER_ALREADY_POSTED));
            }

            if (existing.Count > 0)
            {
                logger.LogInfo($"Transfer already queued for SAP. TransferId: {transfer.Id}, Status: {existing[0].Status}");
                return;
            }

            InventoryLocation? from = await repository.InventoryLocation.FindFirstByConditionAsync(x => x.Id == transfer.FromLocationId);
            InventoryLocation? to = await repository.InventoryLocation.FindFirstByConditionAsync(x => x.Id == transfer.ToLocationId);
            BuyerProperty? fromProperty = from == null
                ? null
                : await repository.BuyerProperty.FindFirstByConditionAsync(x => x.Id == from.PropertyId);
            BuyerProperty? toProperty = to == null
                ? null
                : await repository.BuyerProperty.FindFirstByConditionAsync(x => x.Id == to.PropertyId);
            List<Guid> materialIds = items.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, ItemBuyerMaster> materials = materialIds.Count == 0
                ? new Dictionary<Guid, ItemBuyerMaster>()
                : await repository.ItemBuyerMaster.FindByCondition(x => materialIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(repository, materialIds, cancellationToken);
            string? problem = TryBuildBody(transfer, from, to, fromProperty, toProperty, items, materials, conversions, out string? body);
            if (problem != null)
            {
                logger.LogError($"Transfer cannot be posted to SAP. TransferId: {transfer.Id}, Code: {problem}");
                throw new BadRequestCustomException(problem, Describe(problem));
            }

            if (body == null)
            {
                logger.LogInfo($"Transfer has no quantity to post to SAP. TransferId: {transfer.Id}");
                return;
            }

            string? companyCode = string.IsNullOrWhiteSpace(fromProperty?.CompanyCode) ? null : fromProperty.CompanyCode.Trim();
            SilaInventorySap.DecideTransfer(
                fromProperty?.PlantCode, from?.StorageLocationCode, toProperty?.PlantCode, to?.StorageLocationCode,
                fromProperty?.CompanyCode, toProperty?.CompanyCode, out SilaInventorySap.Rule? rule);
            ApiIntegrationConfiguration? api = rule == null
                ? null
                : await SilaInventorySap.ResolveAsync(repository, organizationId, rule.ApiName, companyCode, cancellationToken);
            if (api == null || rule == null)
            {
                string apiName = rule?.ApiName ?? API_CONFIG_NAME;
                logger.LogError($"Transfer SAP API is not active. TransferId: {transfer.Id}, Api: {apiName}, CompanyCode: {companyCode}");
                throw new BadRequestCustomException(SilaInventorySap.SAP_API_CONFIGURATION_NOT_FOUND, SilaInventorySap.MissingApi(apiName));
            }

            InventoryErpPosting posting = ledger.QueueErpPosting(
                Common.SILA_REF_ITO,
                transfer.Id,
                transfer.ItoNumber,
                transfer.FromLocationId,
                rule.GoodsMovementType);
            posting.CompanyCode = companyCode;
            posting.IntegrationSystem = api.Name;
            logger.LogInfo($"Transfer queued for SAP. TransferId: {transfer.Id}, ItoNumber: {transfer.ItoNumber}, PostingId: {posting.Id}");
        }

        /// <summary>
        /// The active FIVE S4 - Transfer Stock configuration for the company code, otherwise ALL.
        /// No other API is returned.
        /// </summary>
        public static async Task<ApiIntegrationConfiguration?> ResolveAsync(
            IRepositoryWrapper repository,
            Guid organizationId,
            string? companyCode,
            CancellationToken cancellationToken)
        {
            List<ApiIntegrationConfiguration> named = await repository.ApiIntegrationConfiguration
                .FindByCondition(x => IntegrationLookup.BuyerIdsOf(repository, organizationId).Contains(x.BuyerId)
                    && x.IsActive
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.Name == API_CONFIG_NAME)
                .ToListAsync(cancellationToken);
            return named.FirstOrDefault(x => companyCode != null && x.EntityCode.Equals(companyCode, StringComparison.OrdinalIgnoreCase))
                ?? named.FirstOrDefault(x => x.EntityCode.Equals(IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase))
                ?? (companyCode == null ? named.OrderBy(x => x.DateCreated).FirstOrDefault() : null);
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
    }
}

using System.Text.RegularExpressions;
using SharedKernel.Integration.Enums;

namespace SharedKernel.Integration.Rules
{
    /// <summary>
    /// What each API type is: which side configures it (the Buyer or the Supplier service), whether
    /// the application calls it (push) or reads from it (pull), and which mapped fields it cannot work
    /// without.
    /// </summary>
    public static class IntegrationProcessCatalog
    {
        public const string SIDE_BUYER = "Buyer";
        public const string SIDE_SUPPLIER = "Supplier";

        private static readonly Dictionary<IntegrationProcessType, IntegrationProcessInfo> Processes = new Dictionary<IntegrationProcessType, IntegrationProcessInfo>
        {
            [IntegrationProcessType.POST_PO] = new IntegrationProcessInfo { IsPush = true },
            [IntegrationProcessType.GET_STOCK] = new IntegrationProcessInfo
            {
                CanPull = true,
                MappingArea = "Stock",
                RequiredTargets = new[] { "Stock.MaterialCode", "Stock.Quantity" }
            },
            // Read by the SILA ME material pull (per company code), not by the scheduled pull: it has its own upsert.
            [IntegrationProcessType.GET_MATERIAL] = new IntegrationProcessInfo
            {
                MappingArea = "Material",
                RequiredTargets = new[] { "Material.Code" }
            },
            [IntegrationProcessType.GET_CONTRACT] = new IntegrationProcessInfo(),
            [IntegrationProcessType.POST_SUPPLIER] = new IntegrationProcessInfo { IsPush = true },
            [IntegrationProcessType.GET_CATALOG] = new IntegrationProcessInfo
            {
                Side = SIDE_SUPPLIER,
                CanPull = true,
                MappingArea = "Catalog",
                RequiredTargets = new[] { "Catalog.Sku", "Catalog.Name", "Catalog.Price", "Catalog.Currency", "Catalog.UnitOfMeasure" }
            },
            [IntegrationProcessType.GET_CATALOG_STOCK] = new IntegrationProcessInfo
            {
                Side = SIDE_SUPPLIER,
                CanPull = true,
                MappingArea = "CatalogStock",
                RequiredTargets = new[] { "CatalogStock.Sku", "CatalogStock.AvailableStock" }
            },
            [IntegrationProcessType.POST_SALES_ORDER] = new IntegrationProcessInfo { Side = SIDE_SUPPLIER, IsPush = true },
            // SILA ME inventory documents. The push types may map their payload field names (optional).
            [IntegrationProcessType.POST_GOODS_MOVEMENT] = new IntegrationProcessInfo { IsPush = true, MappingArea = "GoodsMovement" },
            // Stock-count variances. Reuses goods-movement field mapping. The tested config name is FIVE_POS_UPDATE.
            [IntegrationProcessType.UPDATE_STOCK] = new IntegrationProcessInfo { IsPush = true, MappingArea = "GoodsMovement" },
            [IntegrationProcessType.POST_GRN] = new IntegrationProcessInfo { IsPush = true, MappingArea = "Grn" },
            [IntegrationProcessType.POST_GRN_REVERSAL] = new IntegrationProcessInfo { IsPush = true, MappingArea = "Grn" },
            [IntegrationProcessType.GET_POS_SALE] = new IntegrationProcessInfo
            {
                CanPull = true,
                MappingArea = "PosSale",
                RequiredTargets = new[] { "PosSale.TransactionId", "PosSale.BusinessDate", "PosSale.PosCode", "PosSale.Quantity", "PosSale.OutletCode" }
            },
            // SILA ME receiving: the invoice is posted after its goods receipt; suppliers and purchase orders are read from the ERP.
            [IntegrationProcessType.POST_INVOICE] = new IntegrationProcessInfo { IsPush = true, MappingArea = "Invoice" },
            // URL attachment on a supplier invoice that S/4 has already created. It does not post the invoice.
            [IntegrationProcessType.SUPPLIER_INVOICE_ATTACHMENT] = new IntegrationProcessInfo { IsPush = true, MappingArea = "InvoiceAttachment" },
            [IntegrationProcessType.GET_SUPPLIER] = new IntegrationProcessInfo
            {
                CanPull = true,
                MappingArea = "Supplier",
                RequiredTargets = new[] { "Supplier.Code", "Supplier.Name" }
            },
            [IntegrationProcessType.GET_PO] = new IntegrationProcessInfo
            {
                CanPull = true,
                MappingArea = "Po",
                RequiredTargets = new[] { "Po.Number", "Po.SupplierCode", "Po.Items.LineNumber", "Po.Items.Quantity" }
            },
            // The invoice file is sent ({fileName, contentType, contentBase64}); the answer is read through the mapping.
            [IntegrationProcessType.EXTRACT_INVOICE] = new IntegrationProcessInfo { IsPush = true, MappingArea = "InvoiceExtraction" },
            // The executed contract (approved and signed by both parties) is sent to the ERP; the answer's id is kept as the contract's ErpContractId.
            [IntegrationProcessType.POST_CONTRACT] = new IntegrationProcessInfo { IsPush = true },
        };

        // A type an organization adds itself. GET_ reads from the external system; POST_ sends to it.
        // Built-in types such as UPDATE_STOCK are recognized before this pattern.
        private static readonly Regex CustomCode = new Regex(@"^(GET_|POST_)[A-Z][A-Z0-9_]*$", RegexOptions.Compiled);

        /// <summary>Trims and uppercases an API type code.</summary>
        public static string Canonical(string? processType)
        {
            return (processType ?? string.Empty).Trim().ToUpperInvariant();
        }

        /// <summary>True when the code is one of the built-in API types.</summary>
        public static bool TryKnown(string? processType, out IntegrationProcessType known)
        {
            if (Enum.TryParse(processType, ignoreCase: false, out known) && Enum.IsDefined(known) && known.ToString() == processType)
            {
                return true;
            }

            known = default;
            return false;
        }

        /// <summary>True for a code an organization may add, such as GET_PRICE or POST_PAYMENT.</summary>
        public static bool IsCustomCode(string? processType)
        {
            return !string.IsNullOrEmpty(processType)
                && processType.Length <= 30
                && !TryKnown(processType, out _)
                && CustomCode.IsMatch(processType);
        }

        /// <summary>The API type's description. A custom code is a connection only: it is not pulled into application data.</summary>
        public static IntegrationProcessInfo? Find(string? processType)
        {
            if (TryKnown(processType, out IntegrationProcessType known) && Processes.TryGetValue(known, out IntegrationProcessInfo? info))
            {
                return info;
            }

            if (!IsCustomCode(processType))
            {
                return null;
            }

            return new IntegrationProcessInfo { IsPush = processType!.StartsWith("POST_", StringComparison.Ordinal) };
        }

        /// <summary>The API type's description, or null for a type that is not offered.</summary>
        public static IntegrationProcessInfo? Find(IntegrationProcessType processType)
        {
            return Find(processType.ToString());
        }

        /// <summary>Whether the API type belongs to the given side (the service that configures it). A custom code belongs to the service that stores it.</summary>
        public static bool BelongsTo(string? processType, string side)
        {
            if (TryKnown(processType, out IntegrationProcessType known))
            {
                return BelongsTo(known, side);
            }

            return IsCustomCode(processType);
        }

        /// <summary>Whether the API type belongs to the given side (the service that configures it).</summary>
        public static bool BelongsTo(IntegrationProcessType processType, string side)
        {
            IntegrationProcessInfo? info = Find(processType);
            return info != null && string.Equals(info.Side, side, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>Built-in API types whose mapped fields are listed. A custom code has none.</summary>
        public static List<IntegrationProcessType> TargetTypes(string? processType, string side)
        {
            if (string.IsNullOrWhiteSpace(processType))
            {
                return Processes
                    .Where(item => string.Equals(item.Value.Side, side, StringComparison.OrdinalIgnoreCase))
                    .Select(item => item.Key)
                    .ToList();
            }

            string code = Canonical(processType);
            if (TryKnown(code, out IntegrationProcessType known) && BelongsTo(known, side))
            {
                return new List<IntegrationProcessType> { known };
            }

            return new List<IntegrationProcessType>();
        }

        /// <summary>The API types of the side that can be pulled by a manual or scheduled run.</summary>
        public static List<IntegrationProcessType> PullableTypes(string side)
        {
            return Processes
                .Where(item => item.Value.CanPull && string.Equals(item.Value.Side, side, StringComparison.OrdinalIgnoreCase))
                .Select(item => item.Key)
                .ToList();
        }

        /// <summary>Whether the target field belongs to the records of the API type, for example "Catalog." for the catalog.</summary>
        public static bool OwnsTarget(string? processType, string targetField)
        {
            string? area = Find(processType)?.MappingArea;
            return area != null && targetField.StartsWith(area + ".", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>Whether the target field belongs to the records of the API type, for example "Catalog." for the catalog.</summary>
        public static bool OwnsTarget(IntegrationProcessType processType, string targetField)
        {
            return OwnsTarget(processType.ToString(), targetField);
        }
    }
}

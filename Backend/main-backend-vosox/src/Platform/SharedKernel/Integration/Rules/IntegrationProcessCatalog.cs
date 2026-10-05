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
            [IntegrationProcessType.POST_GRN] = new IntegrationProcessInfo { IsPush = true, MappingArea = "Grn" },
            [IntegrationProcessType.GET_POS_SALE] = new IntegrationProcessInfo
            {
                CanPull = true,
                MappingArea = "PosSale",
                RequiredTargets = new[] { "PosSale.TransactionId", "PosSale.BusinessDate", "PosSale.PosCode", "PosSale.Quantity", "PosSale.OutletCode" }
            },
            // SILA ME receiving: the invoice is posted after its goods receipt; suppliers and purchase orders are read from the ERP.
            [IntegrationProcessType.POST_INVOICE] = new IntegrationProcessInfo { IsPush = true, MappingArea = "Invoice" },
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
        };

        /// <summary>The API type's description, or null for a type that is not offered.</summary>
        public static IntegrationProcessInfo? Find(IntegrationProcessType processType)
        {
            return Processes.TryGetValue(processType, out IntegrationProcessInfo? info) ? info : null;
        }

        /// <summary>Whether the API type belongs to the given side (the service that configures it).</summary>
        public static bool BelongsTo(IntegrationProcessType processType, string side)
        {
            IntegrationProcessInfo? info = Find(processType);
            return info != null && string.Equals(info.Side, side, StringComparison.OrdinalIgnoreCase);
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
        public static bool OwnsTarget(IntegrationProcessType processType, string targetField)
        {
            string? area = Find(processType)?.MappingArea;
            return area != null && targetField.StartsWith(area + ".", StringComparison.OrdinalIgnoreCase);
        }
    }
}

namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A purchase order to create. It is saved in this system first; then it is handed to the buyer's ERP (when the buyer has an
    /// active purchase order API) and to the supplier's ERP (when the supplier has an active sales order API).
    /// </summary>
    public class CreatePurchaseOrderRequestDto
    {
        /// <summary>The supplier (supplier profile id of the Supplier service) the order is for.</summary>
        public Guid SupplierId { get; set; }

        public string? CompanyCode { get; set; }
        public string? PlantCode { get; set; }

        /// <summary>3-letter ISO code, for example AED.</summary>
        public string? Currency { get; set; }

        /// <summary>Defaults to today.</summary>
        public DateTime? OrderDate { get; set; }
        public DateTime? DeliveryDate { get; set; }

        // ---- ERP details, for a buyer ERP of the SAP S/4 kind. Send them when the order goes to such an ERP: it needs the
        // purchasing organization and group, the supplier's vendor number and the plant (PlantCode above), and then the order is
        // sent in the shape of the S/4 purchase order API, as the orders of a contract are. Without any of them the order is
        // sent in the standard shape. The company code is CompanyCode above.

        /// <summary>For example NB. Defaults to NB.</summary>
        public string? PurchaseOrderType { get; set; }
        public string? PurchasingOrganization { get; set; }
        public string? PurchasingGroup { get; set; }

        /// <summary>The supplier's vendor number in the ERP. Defaults to the code of the supplier in the Supplier Master.</summary>
        public string? SupplierCode { get; set; }
        public string? StorageLocation { get; set; }

        /// <summary>Not sent unless given (a normal stock item has none). Send U, K or another category for an item that has an account assignment.</summary>
        public string? AccountAssignmentCategory { get; set; }
        public string? GlAccount { get; set; }

        public List<CreatePurchaseOrderLineDto> Lines { get; set; } = new();
    }

    public class CreatePurchaseOrderLineDto
    {
        public string? MaterialCode { get; set; }
        public string? Sku { get; set; }
        public string? Description { get; set; }
        public decimal Quantity { get; set; }
        public string? UnitOfMeasure { get; set; }
        public decimal? UnitPrice { get; set; }
        public string? StorageLocation { get; set; }
    }
}

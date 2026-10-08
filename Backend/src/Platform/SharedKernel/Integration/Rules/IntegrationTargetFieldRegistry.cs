using SharedKernel.Integration.Dtos;

namespace SharedKernel.Integration.Rules
{
    /// <summary>
    /// Target fields an ERP payload can be mapped to.
    /// </summary>
    public static class IntegrationTargetFieldRegistry
    {
        public static readonly List<IntegrationTargetFieldResponseDto> Fields = new List<IntegrationTargetFieldResponseDto>
        {
            Field("Stock.MaterialCode", "Material stock", "string", true, "NONE", "TRIM", "UPPER"),
            Field("Stock.Quantity", "Material stock", "decimal", true, "NONE"),
            Field("Stock.Plant", "Material stock", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Stock.StorageLocation", "Material stock", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Stock.Uom", "Material stock", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Catalog.Sku", "Product catalog", "string", true, "NONE", "TRIM"),
            Field("Catalog.Name", "Product catalog", "string", true, "NONE", "TRIM"),
            Field("Catalog.Price", "Product catalog", "decimal", true, "NONE"),
            Field("Catalog.Currency", "Product catalog", "string", true, "NONE", "UPPER"),
            Field("Catalog.UnitOfMeasure", "Product catalog", "string", true, "NONE", "TRIM", "UPPER"),
            Field("Catalog.Description", "Product catalog", "string", false, "NONE", "TRIM"),
            Field("Catalog.AvailableStock", "Product catalog", "decimal", false, "NONE"),
            Field("Catalog.DiscountPercent", "Product catalog", "decimal", false, "NONE"),
            Field("CatalogStock.Sku", "Product stock", "string", true, "NONE", "TRIM"),
            Field("CatalogStock.AvailableStock", "Product stock", "decimal", true, "NONE"),
            Field("CatalogStock.DiscountPercent", "Product stock", "decimal", false, "NONE"),
            Field("GoodsMovement.ReferenceNumber", "Goods movement", "string", false, "NONE", "TRIM"),
            Field("GoodsMovement.MovementType", "Goods movement", "string", false, "NONE", "UPPER"),
            Field("GoodsMovement.PostingDate", "Goods movement", "date", false, "NONE"),
            Field("GoodsMovement.Plant", "Goods movement", "string", false, "NONE", "TRIM", "UPPER"),
            Field("GoodsMovement.StorageLocation", "Goods movement", "string", false, "NONE", "TRIM", "UPPER"),
            Field("GoodsMovement.CompanyCode", "Goods movement", "string", false, "NONE", "TRIM", "UPPER"),
            Field("GoodsMovement.Items", "Goods movement", "array", false, "NONE"),
            Field("GoodsMovement.Items.MaterialCode", "Goods movement line", "string", false, "NONE", "TRIM", "UPPER"),
            Field("GoodsMovement.Items.Quantity", "Goods movement line", "decimal", false, "NONE"),
            Field("GoodsMovement.Items.Uom", "Goods movement line", "string", false, "NONE", "TRIM", "UPPER"),
            Field("GoodsMovement.Items.Direction", "Goods movement line", "string", false, "NONE", "UPPER"),
            Field("GoodsMovement.Items.StorageLocation", "Goods movement line", "string", false, "NONE", "TRIM", "UPPER"),
            Field("GoodsMovement.Items.CostCenter", "Goods movement line", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Grn.PoNumber", "Goods receipt", "string", false, "NONE", "TRIM"),
            Field("Grn.GrnNumber", "Goods receipt", "string", false, "NONE", "TRIM"),
            Field("Grn.PostingDate", "Goods receipt", "date", false, "NONE"),
            Field("Grn.Plant", "Goods receipt", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Grn.StorageLocation", "Goods receipt", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Grn.DeliveryNote", "Goods receipt", "string", false, "NONE", "TRIM"),
            Field("Grn.Items", "Goods receipt", "array", false, "NONE"),
            Field("Grn.Items.PoLineNumber", "Goods receipt line", "integer", false, "NONE"),
            Field("Grn.Items.MaterialCode", "Goods receipt line", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Grn.Items.Quantity", "Goods receipt line", "decimal", false, "NONE"),
            Field("Grn.Items.Uom", "Goods receipt line", "string", false, "NONE", "TRIM", "UPPER"),
            Field("PosSale.TransactionId", "POS sale", "string", true, "NONE", "TRIM"),
            Field("PosSale.LineId", "POS sale", "integer", false, "NONE"),
            Field("PosSale.BusinessDate", "POS sale", "date", true, "NONE"),
            Field("PosSale.PosCode", "POS sale", "string", true, "NONE", "TRIM", "UPPER"),
            Field("PosSale.Quantity", "POS sale", "decimal", true, "NONE"),
            Field("PosSale.OutletCode", "POS sale", "string", true, "NONE", "TRIM", "UPPER"),
            Field("PosSale.Amount", "POS sale", "decimal", false, "NONE"),
            Field("PosSale.Uom", "POS sale", "string", false, "NONE", "TRIM", "UPPER"),
            Field("PosSale.Currency", "POS sale", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Material.Code", "Material master", "string", true, "NONE", "TRIM", "UPPER"),
            Field("Material.Description", "Material master", "string", false, "NONE", "TRIM"),
            Field("Material.BaseUom", "Material master", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Material.MaterialGroup", "Material master", "string", false, "NONE", "TRIM"),
            Field("Material.UnitPrice", "Material master", "decimal", false, "NONE"),
            Field("Material.Currency", "Material master", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Invoice.InvoiceNumber", "Invoice", "string", false, "NONE", "TRIM"),
            Field("Invoice.InvoiceDate", "Invoice", "date", false, "NONE"),
            Field("Invoice.SupplierCode", "Invoice", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Invoice.SupplierName", "Invoice", "string", false, "NONE", "TRIM"),
            Field("Invoice.PoNumber", "Invoice", "string", false, "NONE", "TRIM"),
            Field("Invoice.GrnNumber", "Invoice", "string", false, "NONE", "TRIM"),
            Field("Invoice.CompanyCode", "Invoice", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Invoice.Currency", "Invoice", "string", false, "NONE", "UPPER"),
            Field("Invoice.GrossAmount", "Invoice", "decimal", false, "NONE"),
            Field("Invoice.Items", "Invoice", "array", false, "NONE"),
            Field("Invoice.Items.LineNumber", "Invoice line", "integer", false, "NONE"),
            Field("Invoice.Items.PoLineNumber", "Invoice line", "integer", false, "NONE"),
            Field("Invoice.Items.MaterialCode", "Invoice line", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Invoice.Items.Description", "Invoice line", "string", false, "NONE", "TRIM"),
            Field("Invoice.Items.Quantity", "Invoice line", "decimal", false, "NONE"),
            Field("Invoice.Items.UnitPrice", "Invoice line", "decimal", false, "NONE"),
            Field("Invoice.Items.Amount", "Invoice line", "decimal", false, "NONE"),
            Field("Supplier.Code", "Supplier", "string", true, "NONE", "TRIM", "UPPER"),
            Field("Supplier.Name", "Supplier", "string", true, "NONE", "TRIM"),
            Field("Supplier.TaxNumber", "Supplier", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Supplier.Country", "Supplier", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Po.Number", "Purchase order", "string", true, "NONE", "TRIM"),
            Field("Po.SupplierCode", "Purchase order", "string", true, "NONE", "TRIM", "UPPER"),
            Field("Po.SupplierName", "Purchase order", "string", false, "NONE", "TRIM"),
            Field("Po.CompanyCode", "Purchase order", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Po.Plant", "Purchase order", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Po.Currency", "Purchase order", "string", false, "NONE", "UPPER"),
            Field("Po.OrderDate", "Purchase order", "date", false, "NONE"),
            Field("Po.Items", "Purchase order", "array", false, "NONE"),
            Field("Po.Items.LineNumber", "Purchase order line", "integer", true, "NONE"),
            Field("Po.Items.MaterialCode", "Purchase order line", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Po.Items.Description", "Purchase order line", "string", false, "NONE", "TRIM"),
            Field("Po.Items.Quantity", "Purchase order line", "decimal", true, "NONE"),
            Field("Po.Items.Uom", "Purchase order line", "string", false, "NONE", "TRIM", "UPPER"),
            Field("Po.Items.UnitPrice", "Purchase order line", "decimal", false, "NONE"),
            Field("InvoiceExtraction.InvoiceNumber", "Invoice extraction", "string", false, "NONE", "TRIM"),
            Field("InvoiceExtraction.InvoiceDate", "Invoice extraction", "date", false, "NONE"),
            Field("InvoiceExtraction.Currency", "Invoice extraction", "string", false, "NONE", "UPPER"),
            Field("InvoiceExtraction.GrossAmount", "Invoice extraction", "decimal", false, "NONE"),
            Field("InvoiceExtraction.SupplierName", "Invoice extraction", "string", false, "NONE", "TRIM"),
            Field("InvoiceExtraction.SupplierTaxNumber", "Invoice extraction", "string", false, "NONE", "TRIM", "UPPER"),
            Field("InvoiceExtraction.PoNumber", "Invoice extraction", "string", false, "NONE", "TRIM"),
            Field("InvoiceExtraction.Confidence", "Invoice extraction", "decimal", false, "NONE"),
            Field("InvoiceExtraction.Text", "Invoice extraction", "string", false, "NONE"),
            Field("InvoiceExtraction.Lines", "Invoice extraction", "array", false, "NONE"),
            Field("InvoiceExtraction.Lines.Description", "Invoice extraction line", "string", false, "NONE", "TRIM"),
            Field("InvoiceExtraction.Lines.Quantity", "Invoice extraction line", "decimal", false, "NONE"),
            Field("InvoiceExtraction.Lines.UnitPrice", "Invoice extraction line", "decimal", false, "NONE"),
            Field("InvoiceExtraction.Lines.Amount", "Invoice extraction line", "decimal", false, "NONE"),
        };

        public static bool Contains(string target)
        {
            return Fields.Any(field => field.TargetField.Equals(target, StringComparison.OrdinalIgnoreCase));
        }

        private static IntegrationTargetFieldResponseDto Field(string target, string area, string dataType, bool required, params string[] transformations)
        {
            return new IntegrationTargetFieldResponseDto
            {
                TargetField = target,
                Area = area,
                DataType = dataType,
                Required = required,
                AllowedTransformations = transformations.ToList()
            };
        }
    }
}

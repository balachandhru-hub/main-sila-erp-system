using System.Text.Json;
using Buyer.Domain.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Purchase order lines as they arrive from Excel (one row per line, header fields repeated) or from the ERP
    /// (GET_PO records, target fields Po.*), turned into <see cref="SilaPoImportRowDto"/> for <see cref="SilaPurchaseOrderSync"/>.
    /// </summary>
    public static class SilaPurchaseOrderRows
    {
        /// <summary>The columns of the purchase order workbook, in order; the import reads them by name.</summary>
        public static readonly string[] Columns =
        {
            "PoNumber", "PoType", "CompanyCode", "SupplierCode", "SupplierName", "Plant", "Currency", "TaxCode", "TotalAmount", "OrderDate",
            "LineNumber", "MaterialCode", "Description", "Quantity", "Uom", "UnitPrice", "ItemCurrency", "ReceivedQuantity", "OpenQuantity",
            "GoodsReceiptExpected", "DeliveryDate"
        };

        /// <summary>The columns an Excel file must have.</summary>
        public static readonly string[] RequiredColumns =
        {
            "PoNumber", "PoType", "CompanyCode", "SupplierCode", "Currency", "TaxCode", "TotalAmount", "LineNumber", "Quantity", "GoodsReceiptExpected"
        };

        /// <summary>The example rows of the template.</summary>
        public static readonly IReadOnlyList<object?>[] TemplateRows =
        {
            new object?[] { "4500001234", "NB", "1000", "SUP-1001", "Gulf Foods LLC", "P100", "AED", "V1", "1050", "2026-10-05", 10, "MAT-001", "Basmati rice 5 kg", 20, "BAG", 45, "AED", 0, 20, "TRUE", "2026-10-08" },
            new object?[] { "4500001234", "NB", "1000", "SUP-1001", "Gulf Foods LLC", "P100", "AED", "V1", "1050", "2026-10-05", 20, "MAT-002", "Olive oil 1 L", 10, "BTL", 15, "AED", 0, 10, "TRUE", "2026-10-08" }
        };

        public static List<SilaPoImportRowDto> FromExcel(List<Dictionary<string, string>> table)
        {
            return table.Select(row => new SilaPoImportRowDto
            {
                RowNumber = SilaReceivingExcel.RowNumber(row),
                PoNumber = SilaReceivingExcel.Value(row, "PoNumber"),
                PoType = SilaReceivingExcel.Value(row, "PoType"),
                CompanyCode = SilaReceivingExcel.Value(row, "CompanyCode"),
                SupplierCode = SilaReceivingExcel.Value(row, "SupplierCode"),
                SupplierName = SilaReceivingExcel.Value(row, "SupplierName"),
                Plant = SilaReceivingExcel.Value(row, "Plant"),
                Currency = SilaReceivingExcel.Value(row, "Currency"),
                TaxCode = SilaReceivingExcel.Value(row, "TaxCode"),
                TotalAmount = SilaReceivingExcel.Value(row, "TotalAmount"),
                OrderDate = SilaReceivingExcel.Value(row, "OrderDate"),
                LineNumber = SilaReceivingExcel.Value(row, "LineNumber"),
                MaterialCode = SilaReceivingExcel.Value(row, "MaterialCode"),
                Description = SilaReceivingExcel.Value(row, "Description"),
                Quantity = SilaReceivingExcel.Value(row, "Quantity"),
                Uom = SilaReceivingExcel.Value(row, "Uom"),
                UnitPrice = SilaReceivingExcel.Value(row, "UnitPrice"),
                ItemCurrency = SilaReceivingExcel.Value(row, "ItemCurrency"),
                ReceivedQuantity = SilaReceivingExcel.Value(row, "ReceivedQuantity"),
                OpenQuantity = SilaReceivingExcel.Value(row, "OpenQuantity"),
                GoodsReceiptExpected = SilaReceivingExcel.Value(row, "GoodsReceiptExpected"),
                DeliveryDate = SilaReceivingExcel.Value(row, "DeliveryDate")
            }).ToList();
        }

        /// <summary>
        /// The lines of one ERP record: a header with its items under Po.Items when that is mapped, otherwise one line per
        /// record. A missing company code is taken from the API's entity code (when it is not ALL).
        /// </summary>
        public static List<SilaPoImportRowDto> FromRecord(IReadOnlyList<ApiFieldMapping> mappings, JsonElement record, string? entityCode, ref int rowNumber)
        {
            string? companyCode = IntegrationRecordReader.Read(mappings, "Po.CompanyCode", record)
                ?? (string.IsNullOrWhiteSpace(entityCode) || entityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase)
                    ? null
                    : entityCode.Trim());
            SilaPoImportRowDto header = new SilaPoImportRowDto
            {
                PoNumber = IntegrationRecordReader.Read(mappings, "Po.Number", record),
                CompanyCode = companyCode,
                SupplierCode = IntegrationRecordReader.Read(mappings, "Po.SupplierCode", record),
                SupplierName = IntegrationRecordReader.Read(mappings, "Po.SupplierName", record),
                Plant = IntegrationRecordReader.Read(mappings, "Po.Plant", record),
                Currency = IntegrationRecordReader.Read(mappings, "Po.Currency", record),
                OrderDate = IntegrationRecordReader.Read(mappings, "Po.OrderDate", record),
                DeliveryDate = IntegrationRecordReader.Read(mappings, "Po.DeliveryDate", record)
            };

            List<SilaPoImportRowDto> lines = new List<SilaPoImportRowDto>();
            ApiFieldMapping? itemsMapping = mappings.FirstOrDefault(x => x.TargetField.Equals("Po.Items", StringComparison.OrdinalIgnoreCase));
            JsonElement? items = itemsMapping == null ? null : IntegrationRecordReader.ReadPath(record, itemsMapping.SourceField);
            IEnumerable<JsonElement> sources = items != null && items.Value.ValueKind == JsonValueKind.Array
                ? items.Value.EnumerateArray().ToList()
                : new List<JsonElement> { record };
            foreach (JsonElement item in sources)
            {
                rowNumber++;
                lines.Add(new SilaPoImportRowDto
                {
                    RowNumber = rowNumber,
                    PoNumber = header.PoNumber,
                    CompanyCode = header.CompanyCode,
                    SupplierCode = header.SupplierCode,
                    SupplierName = header.SupplierName,
                    Plant = header.Plant,
                    Currency = header.Currency,
                    OrderDate = header.OrderDate,
                    DeliveryDate = header.DeliveryDate,
                    GoodsReceiptExpected = IntegrationRecordReader.Read(mappings, "Po.Items.GoodsReceiptExpected", item),
                    LineNumber = IntegrationRecordReader.Read(mappings, "Po.Items.LineNumber", item),
                    MaterialCode = IntegrationRecordReader.Read(mappings, "Po.Items.MaterialCode", item),
                    Description = IntegrationRecordReader.Read(mappings, "Po.Items.Description", item),
                    Quantity = IntegrationRecordReader.Read(mappings, "Po.Items.Quantity", item),
                    Uom = IntegrationRecordReader.Read(mappings, "Po.Items.Uom", item),
                    UnitPrice = IntegrationRecordReader.Read(mappings, "Po.Items.UnitPrice", item)
                });
            }

            return lines;
        }
    }
}

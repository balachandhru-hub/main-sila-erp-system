using System.Globalization;
using System.Text.Json;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The purchase-order fields an supplier invoice needs from FIVE S4 - GET PO: company, supplier, currency,
    /// plant, item, material, unit of measure, price and tax. The read asks for that one purchase order and its items.
    /// </summary>
    public static class SilaPurchaseOrderInvoiceRead
    {
        public const string ITEM_EXPAND = "to_PurchaseOrderItem";

        public sealed class Order
        {
            public string? CompanyCode { get; set; }
            public string? SupplierCode { get; set; }
            public string? Currency { get; set; }
            public string? Plant { get; set; }
            public List<Line> Lines { get; } = new();
        }

        public sealed class Line
        {
            public string? Item { get; set; }
            public string? Material { get; set; }
            public string? Uom { get; set; }
            public string? TaxCode { get; set; }
            public string? Plant { get; set; }
            public string? Quantity { get; set; }
            public string? UnitPrice { get; set; }
        }

        /// <summary>One purchase order, by its number. A date range would omit items when the page is full.</summary>
        public static string Filter(string purchaseOrderNumber)
        {
            string number = purchaseOrderNumber.Trim().Replace("'", "''", StringComparison.Ordinal);
            return "PurchaseOrder eq '" + number + "'";
        }

        /// <summary>Keeps an expand the API already has, and adds the purchase-order items when it does not.</summary>
        public static string WithItemExpand(string url)
        {
            if (url.Contains(ITEM_EXPAND, StringComparison.OrdinalIgnoreCase))
            {
                return url;
            }

            return url + (url.Contains('?') ? "&" : "?") + "$expand=" + Uri.EscapeDataString(ITEM_EXPAND);
        }

        public static Order FromRecord(IReadOnlyList<ApiFieldMapping> mappings, JsonElement record)
        {
            Order order = new Order
            {
                CompanyCode = Text(IntegrationRecordReader.Read(mappings, "Po.CompanyCode", record), Property(record, "CompanyCode")),
                SupplierCode = BusinessCode(Text(IntegrationRecordReader.Read(mappings, "Po.SupplierCode", record), Property(record, "Supplier"))),
                Currency = Text(IntegrationRecordReader.Read(mappings, "Po.Currency", record), Property(record, "DocumentCurrency")),
                Plant = Text(IntegrationRecordReader.Read(mappings, "Po.Plant", record), Property(record, "Plant"))
            };

            foreach (JsonElement item in Items(mappings, record))
            {
                Line line = new Line
                {
                    Item = Text(IntegrationRecordReader.Read(mappings, "Po.Items.LineNumber", item), Property(item, "PurchaseOrderItem")),
                    Material = Text(IntegrationRecordReader.Read(mappings, "Po.Items.MaterialCode", item), Property(item, "Material")),
                    Uom = Text(IntegrationRecordReader.Read(mappings, "Po.Items.Uom", item), Property(item, "PurchaseOrderQuantityUnit")),
                    TaxCode = Text(IntegrationRecordReader.Read(mappings, "Po.Items.TaxCode", item), Property(item, "TaxCode")),
                    Plant = Text(IntegrationRecordReader.Read(mappings, "Po.Items.Plant", item), Property(item, "Plant")),
                    Quantity = Text(IntegrationRecordReader.Read(mappings, "Po.Items.Quantity", item), Property(item, "OrderQuantity")),
                    UnitPrice = Text(IntegrationRecordReader.Read(mappings, "Po.Items.UnitPrice", item), Property(item, "NetPriceAmount"))
                };
                if (string.IsNullOrWhiteSpace(order.Plant))
                {
                    order.Plant = line.Plant;
                }

                order.Lines.Add(line);
            }

            return order;
        }

        /// <summary>Fields the invoice post cannot fill when the purchase order did not return them. Tax is used when the item has one.</summary>
        public static string? MissingMessage(Order order, IReadOnlyCollection<int> invoiceLines)
        {
            List<string> missing = new List<string>();
            if (string.IsNullOrWhiteSpace(order.CompanyCode))
            {
                missing.Add("Company code");
            }

            if (string.IsNullOrWhiteSpace(order.SupplierCode))
            {
                missing.Add("Supplier");
            }

            if (string.IsNullOrWhiteSpace(order.Currency))
            {
                missing.Add("Currency");
            }

            if (order.Lines.Count == 0)
            {
                missing.Add("Purchase order items");
            }

            foreach (int lineNumber in invoiceLines.Distinct().OrderBy(x => x))
            {
                Line? line = order.Lines.FirstOrDefault(x => SameItem(x.Item, lineNumber));
                string item = lineNumber.ToString("00000", CultureInfo.InvariantCulture);
                if (line == null)
                {
                    missing.Add("Purchase order item " + item);
                }
                else if (string.IsNullOrWhiteSpace(line.Uom))
                {
                    missing.Add("Unit of measure for item " + item);
                }
            }

            return missing.Count == 0
                ? null
                : SilaInvoiceLifecycle.API_GET_PO + " did not return " + string.Join(", ", missing) + ".";
        }

        private static IEnumerable<JsonElement> Items(IReadOnlyList<ApiFieldMapping> mappings, JsonElement record)
        {
            ApiFieldMapping? itemsMapping = mappings.FirstOrDefault(x => x.TargetField.Equals("Po.Items", StringComparison.OrdinalIgnoreCase));
            JsonElement? items = itemsMapping == null ? null : IntegrationRecordReader.ReadPath(record, itemsMapping.SourceField);
            items ??= IntegrationRecordReader.ReadPath(record, ITEM_EXPAND + "/results");
            items ??= IntegrationRecordReader.ReadPath(record, ITEM_EXPAND);
            if (items != null && items.Value.ValueKind == JsonValueKind.Object
                && items.Value.TryGetProperty("results", out JsonElement nested) && nested.ValueKind == JsonValueKind.Array)
            {
                items = nested;
            }

            if (items == null || items.Value.ValueKind != JsonValueKind.Array)
            {
                yield break;
            }

            foreach (JsonElement item in items.Value.EnumerateArray())
            {
                yield return item;
            }
        }

        private static string? Text(string? mapped, string? sap)
        {
            return string.IsNullOrWhiteSpace(mapped) ? sap : mapped.Trim();
        }

        private static string? Property(JsonElement element, string name)
        {
            if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out JsonElement value)
                || value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined or JsonValueKind.Object or JsonValueKind.Array)
            {
                return null;
            }

            string? text = value.ValueKind == JsonValueKind.String ? value.GetString() : value.ToString();
            return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
        }

        private static string? BusinessCode(string? code)
        {
            string? text = string.IsNullOrWhiteSpace(code) ? null : code.Trim();
            return text != null && Guid.TryParse(text, out _) ? null : text;
        }

        private static bool SameItem(string? item, int lineNumber)
        {
            return int.TryParse(item, NumberStyles.Integer, CultureInfo.InvariantCulture, out int number) && number == lineNumber;
        }
    }
}

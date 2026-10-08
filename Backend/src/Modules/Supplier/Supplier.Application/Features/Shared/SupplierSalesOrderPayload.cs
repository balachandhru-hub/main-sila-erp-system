using System.Globalization;
using System.Text.Json;
using SharedKernel.Integration.Dtos;

namespace Supplier.Application.Features.Shared
{
    /// <summary>
    /// The body sent to the supplier's ERP for a purchase order of a buyer. The supplier's sales order API may keep its own body
    /// (RequestBody of the API) with {{name}} placeholders; without one a standard JSON order is sent.
    /// </summary>
    public static class SupplierSalesOrderPayload
    {
        public static string Build(SupplierSalesOrderRequestDto order, string? template)
        {
            return string.IsNullOrWhiteSpace(template) ? Standard(order) : Apply(template, order);
        }

        private static string Standard(SupplierSalesOrderRequestDto order)
        {
            return JsonSerializer.Serialize(new
            {
                purchaseOrderNumber = order.PurchaseOrderNumber,
                localPurchaseOrderNumber = order.LocalPurchaseOrderNumber,
                idempotencyKey = order.IdempotencyKey,
                buyerOrganizationId = order.BuyerOrganizationId,
                buyerName = order.BuyerName,
                companyCode = order.CompanyCode,
                plant = order.PlantCode,
                currency = order.Currency,
                orderDate = order.OrderDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                deliveryDate = order.DeliveryDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                totalAmount = order.TotalAmount,
                lines = Lines(order)
            });
        }

        private static IEnumerable<object> Lines(SupplierSalesOrderRequestDto order)
        {
            return order.Lines.Select(line => (object)new
            {
                lineNumber = line.LineNumber,
                materialCode = line.MaterialCode,
                sku = line.Sku,
                description = line.Description,
                quantity = line.Quantity,
                unitOfMeasure = line.UnitOfMeasure,
                unitPrice = line.UnitPrice,
                lineAmount = line.LineAmount,
                currency = line.Currency,
                storageLocation = line.StorageLocation
            });
        }

        // The values are escaped for JSON, so a name with a quote cannot break the body.
        private static string Apply(string template, SupplierSalesOrderRequestDto order)
        {
            return template
                .Replace("{{purchaseOrderNumber}}", Text(order.PurchaseOrderNumber))
                .Replace("{{poNumber}}", Text(order.PurchaseOrderNumber))
                .Replace("{{localPurchaseOrderNumber}}", Text(order.LocalPurchaseOrderNumber))
                .Replace("{{buyerName}}", Text(order.BuyerName))
                .Replace("{{companyCode}}", Text(order.CompanyCode))
                .Replace("{{plant}}", Text(order.PlantCode))
                .Replace("{{currency}}", Text(order.Currency))
                .Replace("{{orderDate}}", order.OrderDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))
                .Replace("{{deliveryDate}}", order.DeliveryDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty)
                .Replace("{{totalAmount}}", order.TotalAmount.ToString(CultureInfo.InvariantCulture))
                .Replace("{{idempotencyKey}}", Text(order.IdempotencyKey))
                .Replace("{{entries}}", JsonSerializer.Serialize(Lines(order)));
        }

        private static string Text(string? value)
        {
            string json = JsonSerializer.Serialize(value ?? string.Empty);
            return json.Substring(1, json.Length - 2);
        }
    }
}

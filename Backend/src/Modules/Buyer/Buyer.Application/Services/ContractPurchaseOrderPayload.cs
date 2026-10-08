using System.Globalization;
using System.Text.Json;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;

namespace Buyer.Application.Services
{
    /// <summary>
    /// The request body of a purchase order created from a contract, in the shape of the SAP S/4 purchase order
    /// API: the header (order type, purchasing organization and group, company code, supplier, date, currency) and
    /// _PurchaseOrderItem with each item's account assignment. A buyer that configured its own body template under
    /// Integrations gets that template, with the tokens filled in ({{supplierId}}, {{currency}} and {{entries}} are other names of {{supplierCode}}, {{documentCurrency}} and {{items}}).
    /// </summary>
    public static class ContractPurchaseOrderPayload
    {
        public const string DEFAULT_ORDER_TYPE = "NB";
        public const string DEFAULT_ACCOUNT_ASSIGNMENT_CATEGORY = "U";

        /// <summary>The ERP details saved on the order, or an empty set for an order created without any.</summary>
        public static CreateContractPurchaseOrderRequestDto ReadOptions(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return new CreateContractPurchaseOrderRequestDto();
            }

            try
            {
                return JsonSerializer.Deserialize<CreateContractPurchaseOrderRequestDto>(json) ?? new CreateContractPurchaseOrderRequestDto();
            }
            catch (JsonException)
            {
                return new CreateContractPurchaseOrderRequestDto();
            }
        }

        public static string Build(
            PurchaseOrder order,
            IReadOnlyList<PurchaseOrderItem> items,
            CreateContractPurchaseOrderRequestDto options,
            string? template,
            string? contractNumber)
        {
            string orderType = Text(options.PurchaseOrderType) ?? DEFAULT_ORDER_TYPE;
            // Not set (null): the default U, as the orders of a contract have always had. Set to an empty text: no account
            // assignment category is sent, which is how a normal stock item is ordered.
            string? category = options.AccountAssignmentCategory == null ? DEFAULT_ACCOUNT_ASSIGNMENT_CATEGORY : Text(options.AccountAssignmentCategory);
            string date = (options.PurchaseOrderDate ?? order.OrderDate).ToString("yyyy-MM-dd'T'00:00:00", CultureInfo.InvariantCulture);

            List<Dictionary<string, object>> orderItems = new List<Dictionary<string, object>>();
            for (int index = 0; index < items.Count; index++)
            {
                orderItems.Add(Item(items[index], (index + 1) * 10, category, options, order.Currency));
            }

            if (!string.IsNullOrWhiteSpace(template))
            {
                return template
                    .Replace("{{purchaseOrderNumber}}", order.PoNumber)
                    .Replace("{{purchaseOrderId}}", order.Id.ToString())
                    .Replace("{{contractId}}", order.ContractId?.ToString() ?? string.Empty)
                    .Replace("{{contractNumber}}", contractNumber ?? string.Empty)
                    .Replace("{{purchaseOrderType}}", orderType)
                    .Replace("{{purchasingOrganization}}", options.PurchasingOrganization ?? string.Empty)
                    .Replace("{{purchasingGroup}}", options.PurchasingGroup ?? string.Empty)
                    .Replace("{{companyCode}}", options.CompanyCode ?? string.Empty)
                    .Replace("{{supplierCode}}", options.SupplierCode ?? string.Empty)
                    .Replace("{{supplierId}}", options.SupplierCode ?? string.Empty)
                    .Replace("{{purchaseOrderDate}}", date)
                    .Replace("{{documentCurrency}}", order.Currency ?? string.Empty)
                    .Replace("{{currency}}", order.Currency ?? string.Empty)
                    .Replace("{{items}}", JsonSerializer.Serialize(orderItems))
                    .Replace("{{entries}}", JsonSerializer.Serialize(orderItems));
            }

            return JsonSerializer.Serialize(new Dictionary<string, object>
            {
                ["PurchaseOrderType"] = orderType,
                ["PurchasingOrganization"] = options.PurchasingOrganization ?? string.Empty,
                ["PurchasingGroup"] = options.PurchasingGroup ?? string.Empty,
                ["CompanyCode"] = options.CompanyCode ?? string.Empty,
                ["Supplier"] = options.SupplierCode ?? string.Empty,
                ["PurchaseOrderDate"] = date,
                ["DocumentCurrency"] = order.Currency ?? string.Empty,
                ["_PurchaseOrderItem"] = orderItems
            });
        }

        private static Dictionary<string, object> Item(PurchaseOrderItem item, int number, string? category, CreateContractPurchaseOrderRequestDto options, string? orderCurrency)
        {
            Dictionary<string, object> result = new Dictionary<string, object>
            {
                ["PurchaseOrderItem"] = number.ToString(CultureInfo.InvariantCulture),
                ["PurchaseOrderItemText"] = item.ProductName
            };
            Add(result, "AccountAssignmentCategory", category);
            Add(result, "Material", item.MaterialCode);
            // Quantities and prices are JSON numbers: OData V4 sends a decimal as text only when the call asks for IEEE754Compatible,
            // and S/4 refuses "OrderQuantity": "5" ("Property 'OrderQuantity' has invalid value '5'").
            result["OrderQuantity"] = Number(item.Quantity);
            string? unit = Text(item.UnitOfMeasure);
            Add(result, "PurchaseOrderQuantityUnit", unit);
            result["NetPriceAmount"] = Number(item.UnitPrice ?? 0);

            // S/4 wants the currency of the item next to its price (NetPriceAmount): "Together with property 'NetPriceAmount' also
            // property 'DocumentCurrency' needs to be provided". The currency of the line, otherwise that of the order.
            Add(result, "DocumentCurrency", Text(item.Currency) ?? Text(orderCurrency));

            // The price per quantity (NetPriceQuantity) comes with the unit it is priced in (OrderPriceUnit): "Together with property
            // 'NetPriceQuantity' also property 'OrderPriceUnit' needs to be provided". The price is per one unit of the order unit.
            if (unit != null)
            {
                result["NetPriceQuantity"] = 1;
                result["OrderPriceUnit"] = unit;
            }

            Add(result, "Plant", options.Plant);
            Add(result, "StorageLocation", Text(item.StorageLocation) ?? options.StorageLocation);
            Add(result, "MaterialGroup", item.MaterialGroup);

            string? costCenter = Text(item.CostCenter);
            string? glAccount = Text(options.GlAccount);
            if (costCenter != null || glAccount != null)
            {
                Dictionary<string, object> assignment = new Dictionary<string, object>
                {
                    ["Quantity"] = Number(item.Quantity)
                };
                Add(assignment, "CostCenter", costCenter);
                Add(assignment, "GLAccount", glAccount);
                result["_PurOrdAccountAssignment"] = new[] { assignment };
            }

            return result;
        }

        // A decimal as a JSON number without the zeros the database adds: 5.0000 is sent as 5, 70.4600 as 70.46.
        private static decimal Number(decimal value)
        {
            return value / 1.0000000000000000000000000000m;
        }

        // Empty values are left out: the ERP treats an empty string as a value, not as missing.
        private static void Add(Dictionary<string, object> target, string name, string? value)
        {
            string? text = Text(value);
            if (text != null)
            {
                target[name] = text;
            }
        }

        private static string? Text(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
    }
}

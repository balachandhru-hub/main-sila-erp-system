using System.Globalization;
using System.Text.Json;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Prepared FIVE S4-INVOICE CREDITMEMO values stored on the credit memo before SAP is called.
    /// The mapper reads this document only. It does not call GET PO.
    /// </summary>
    public static class SilaCreditMemoPostingData
    {
        public const string READY = "READY_TO_POST";
        public const string INVALID = "VALIDATION_FAILED";
        public const string SOURCE_INVOICE = "REFERENCE_INVOICE";
        public const string SOURCE_INVOICE_POSTING = "REFERENCE_INVOICE_POSTING_DATA";
        public const string SOURCE_LINE = "CREDIT_MEMO_LINE";
        public const string SOURCE_CONFIGURATION = "CONFIGURATION";

        private static readonly JsonSerializerOptions Json = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        public sealed class Prepared
        {
            public int Version { get; set; }
            public string PreparationStatus { get; set; } = INVALID;
            public DateTime PreparedAt { get; set; }
            public Guid PreparedBy { get; set; }
            public Guid ReferenceInvoiceId { get; set; }
            public string? ReferenceErpInvoiceId { get; set; }
            public string? ReferenceFiscalYear { get; set; }
            public List<Field> Header { get; set; } = new();
            public List<Line> Lines { get; set; } = new();
        }

        public sealed class Field
        {
            public string ApiField { get; set; } = string.Empty;
            public string Label { get; set; } = string.Empty;
            public string? Value { get; set; }
            public string Source { get; set; } = string.Empty;
            public bool Required { get; set; }
        }

        public sealed class Line
        {
            public Guid CreditMemoItemId { get; set; }
            public Guid? ReferenceInvoiceLineId { get; set; }
            public int LineNumber { get; set; }
            public List<Field> Fields { get; set; } = new();
        }

        public static string Write(Prepared prepared)
        {
            return JsonSerializer.Serialize(prepared, Json);
        }

        public static Prepared? Read(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<Prepared>(json, Json);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        public static string? Header(Prepared? prepared, string name)
        {
            return prepared?.Header.LastOrDefault(x => x.ApiField.Equals(name, StringComparison.OrdinalIgnoreCase))?.Value;
        }

        public static string? LineValue(Line line, string name)
        {
            return line.Fields.LastOrDefault(x => x.ApiField.Equals(name, StringComparison.OrdinalIgnoreCase))?.Value;
        }

        public static List<string> Missing(Prepared? prepared)
        {
            List<string> missing = new List<string>();
            if (prepared == null)
            {
                missing.Add("Credit memo posting data is not stored.");
                return missing;
            }

            Require(Header(prepared, "CompanyCode"), "Company code, from the original invoice", missing);
            Require(Header(prepared, "DocumentDate"), "Document date, from the credit memo", missing);
            Require(Header(prepared, "PostingDate"), "Posting date, from the credit memo", missing);
            Require(Header(prepared, "SupplierInvoiceIDByInvoicingParty"), "Credit memo reference", missing);
            Require(Header(prepared, "InvoicingParty"), "Supplier, from the original invoice", missing);
            Require(Header(prepared, "DocumentCurrency"), "Currency, from the original invoice", missing);
            Require(Header(prepared, "InvoiceGrossAmount"), "Credit amount", missing);
            Require(Header(prepared, "TaxCalculationDate"), "Tax calculation date, from the credit memo", missing);
            if (prepared.Lines.Count == 0)
            {
                missing.Add("Credit memo lines with quantity or amount");
            }

            foreach (Line line in prepared.Lines)
            {
                Require(LineValue(line, "PurchaseOrder"), "Purchase order, from the original invoice line", missing);
                Require(LineValue(line, "PurchaseOrderItem"), "PO item, from the original invoice posting data", missing);
                Require(LineValue(line, "SupplierInvoiceItemAmount"), "Credit line amount", missing);
                Require(LineValue(line, "Quantity"), "Credit quantity", missing);
                Require(LineValue(line, "PurchaseOrderQuantityUnit"), "UOM, from the original invoice", missing);
                Require(LineValue(line, "TaxCode"), "Tax code, from the original invoice posting line", missing);
            }

            return missing.Distinct().ToList();
        }

        public static async Task StoreAsync(
            IRepositoryWrapper repository,
            CreditMemo memo,
            Invoice invoice,
            IReadOnlyList<CreditMemoItem> items,
            Guid userId,
            CancellationToken cancellationToken)
        {
            List<InvoiceItem> invoiceItems = await repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            List<Guid> poItemIds = invoiceItems.Where(x => x.PurchaseOrderItemId != null).Select(x => x.PurchaseOrderItemId!.Value).Distinct().ToList();
            List<PurchaseOrderItem> poItems = poItemIds.Count == 0
                ? new List<PurchaseOrderItem>()
                : await repository.PurchaseOrderItem.FindByCondition(x => poItemIds.Contains(x.Id)).ToListAsync(cancellationToken);
            Guid? purchaseOrderSupplierId = invoice.PurchaseOrderId == null
                ? null
                : await repository.PurchaseOrder
                    .FindByCondition(x => x.Id == invoice.PurchaseOrderId)
                    .Select(x => (Guid?)x.SupplierId)
                    .FirstOrDefaultAsync(cancellationToken);
            string? supplierCode = await SilaReceivingRules.ErpSupplierCodeAsync(
                repository, purchaseOrderSupplierId, invoice.SupplierId, invoice.SilaSupplierId, cancellationToken);
            SilaInvoicePostingData.Prepared? invoicePrepared = SilaInvoicePostingData.Read(invoice.PostingData);
            int version = (Read(memo.PostingData)?.Version ?? 0) + 1;
            Prepared prepared = Compose(memo, invoice, items, invoiceItems, poItems, invoicePrepared, supplierCode, userId, version);
            List<string> missing = Missing(prepared);
            prepared.PreparationStatus = missing.Count == 0 ? READY : INVALID;
            memo.PostingData = Write(prepared);
            repository.CreditMemo.Update(memo);
        }

        public static Prepared Compose(
            CreditMemo memo,
            Invoice invoice,
            IReadOnlyList<CreditMemoItem> items,
            IReadOnlyList<InvoiceItem> invoiceItems,
            IReadOnlyList<PurchaseOrderItem> poItems,
            SilaInvoicePostingData.Prepared? invoicePrepared,
            string? supplierCode,
            Guid userId,
            int version)
        {
            string? company = First(
                memo.CompanyCode,
                InvoiceHeader(invoicePrepared, "CompanyCode"),
                invoice.CompanyCode);
            string? supplier = First(
                InvoiceHeader(invoicePrepared, "SupplierCode"),
                InvoiceHeader(invoicePrepared, "InvoicingParty"),
                SilaReceivingRules.ErpCode(supplierCode));
            string? currency = First(memo.Currency, InvoiceHeader(invoicePrepared, "Currency"), invoice.Currency);
            string? documentDate = SapDate(memo.DocumentDate);
            string? postingDate = SapDate(memo.PostingDate) ?? documentDate;
            string? taxDate = SapDate(memo.TaxCalculationDate) ?? postingDate;
            string? reference = First(memo.CreditMemoReference, memo.CreditMemoNumber);
            string? gross = Money(memo.GrossAmount);
            Prepared prepared = new Prepared
            {
                Version = version < 1 ? 1 : version,
                PreparedAt = DateTime.UtcNow,
                PreparedBy = userId,
                ReferenceInvoiceId = invoice.Id,
                ReferenceErpInvoiceId = memo.ReferenceErpInvoiceId,
                ReferenceFiscalYear = memo.ReferenceFiscalYear
            };
            prepared.Header.Add(FieldOf("CompanyCode", "Company code", company, SOURCE_INVOICE, true));
            prepared.Header.Add(FieldOf("DocumentDate", "Document date", documentDate, SOURCE_LINE, true));
            prepared.Header.Add(FieldOf("PostingDate", "Posting date", postingDate, SOURCE_LINE, true));
            prepared.Header.Add(FieldOf("SupplierInvoiceIDByInvoicingParty", "Credit memo reference", reference, SOURCE_LINE, true));
            prepared.Header.Add(FieldOf("InvoicingParty", "Supplier", supplier, SOURCE_INVOICE, true));
            prepared.Header.Add(FieldOf("DocumentCurrency", "Currency", currency, SOURCE_INVOICE, true));
            prepared.Header.Add(FieldOf("InvoiceGrossAmount", "Gross amount", gross, SOURCE_LINE, true));
            prepared.Header.Add(FieldOf("AccountingDocumentType", "Accounting document type", SilaCreditMemoLifecycle.DOCUMENT_TYPE, SOURCE_CONFIGURATION, true));
            prepared.Header.Add(FieldOf("BusinessPartnerPostingType", "Business partner posting type", SilaCreditMemoLifecycle.PARTNER_POSTING_TYPE, SOURCE_CONFIGURATION, true));
            prepared.Header.Add(FieldOf("TaxCalculationDate", "Tax calculation date", taxDate, SOURCE_LINE, true));

            foreach (CreditMemoItem item in items.Where(x => (x.Quantity ?? 0) > 0 || (x.Amount ?? 0) > 0).OrderBy(x => x.LineNumber))
            {
                InvoiceItem? invoiceItem = item.ReferenceInvoiceLineId == null
                    ? null
                    : invoiceItems.FirstOrDefault(x => x.Id == item.ReferenceInvoiceLineId);
                PurchaseOrderItem? poItem = invoiceItem?.PurchaseOrderItemId == null
                    ? null
                    : poItems.FirstOrDefault(x => x.Id == invoiceItem.PurchaseOrderItemId);
                SilaInvoicePostingData.Line? invoiceLine = MatchInvoiceLine(invoicePrepared, invoiceItem);
                string? po = First(item.PoNumber, LineField(invoiceLine, "PurchaseOrder"), invoice.PoNumber, memo.PoNumber);
                string? poItemNumber = First(item.PoItem, LineField(invoiceLine, "PurchaseOrderItem"), FormatItem(poItem?.LineNumber.ToString(CultureInfo.InvariantCulture)));
                string? uom = First(item.Uom, LineField(invoiceLine, "PurchaseOrderQuantityUnit"), invoiceItem?.Uom, poItem?.UnitOfMeasure);
                string? tax = First(item.TaxCode, LineField(invoiceLine, "TaxCode"), invoiceItem?.TaxCode, poItem?.TaxCode);
                string? material = First(item.Material, LineField(invoiceLine, "Material"), invoiceItem?.SupplierMaterialCode, poItem?.MaterialCode);
                Line line = new Line
                {
                    CreditMemoItemId = item.Id,
                    ReferenceInvoiceLineId = item.ReferenceInvoiceLineId,
                    LineNumber = item.LineNumber
                };
                line.Fields.Add(FieldOf("InvoicingParty", "Supplier", supplier, SOURCE_INVOICE, true));
                line.Fields.Add(FieldOf("PurchaseOrder", "PO", po, SOURCE_INVOICE_POSTING, true));
                line.Fields.Add(FieldOf("PurchaseOrderItem", "PO item", poItemNumber, SOURCE_INVOICE_POSTING, true));
                line.Fields.Add(FieldOf("SupplierInvoiceItemAmount", "Amount", Money(item.Amount), SOURCE_LINE, true));
                line.Fields.Add(FieldOf("DocumentCurrency", "Currency", currency, SOURCE_INVOICE, true));
                line.Fields.Add(FieldOf("Quantity", "Quantity", Quantity(item.Quantity), SOURCE_LINE, true));
                line.Fields.Add(FieldOf("PurchaseOrderQuantityUnit", "UOM", uom, SOURCE_INVOICE_POSTING, true));
                line.Fields.Add(FieldOf("TaxCode", "Tax code", tax, SOURCE_INVOICE_POSTING, true));
                line.Fields.Add(FieldOf("Material", "Material", material, SOURCE_INVOICE, false));
                line.Fields.Add(FieldOf("Description", "Description", item.Description, SOURCE_LINE, false));
                line.Fields.Add(FieldOf("Reason", "Reason", item.Reason, SOURCE_LINE, false));
                prepared.Lines.Add(line);
            }

            return prepared;
        }

        private static SilaInvoicePostingData.Line? MatchInvoiceLine(SilaInvoicePostingData.Prepared? prepared, InvoiceItem? item)
        {
            if (prepared == null || item == null)
            {
                return null;
            }

            return prepared.Lines.FirstOrDefault(x => x.InvoiceItemId == item.Id)
                ?? prepared.Lines.FirstOrDefault(x => x.InvoiceLine == item.LineNumber);
        }

        private static string? InvoiceHeader(SilaInvoicePostingData.Prepared? prepared, string name)
        {
            return prepared?.Header.LastOrDefault(x => x.ApiField.Equals(name, StringComparison.OrdinalIgnoreCase))?.Value;
        }

        private static string? LineField(SilaInvoicePostingData.Line? line, string name)
        {
            return line?.Fields.LastOrDefault(x => x.ApiField.Equals(name, StringComparison.OrdinalIgnoreCase))?.Value;
        }

        private static Field FieldOf(string apiField, string label, string? value, string source, bool required)
        {
            return new Field
            {
                ApiField = apiField,
                Label = label,
                Value = string.IsNullOrWhiteSpace(value) ? null : value.Trim(),
                Source = source,
                Required = required
            };
        }

        private static void Require(string? value, string label, List<string> missing)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                missing.Add(label);
            }
        }

        private static string? First(params string?[] values)
        {
            return values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim();
        }

        private static string? SapDate(DateTime? value)
        {
            return value == null ? null : value.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        }

        private static string? Money(decimal? value)
        {
            return value == null ? null : value.Value.ToString("0.00", CultureInfo.InvariantCulture);
        }

        private static string? Quantity(decimal? value)
        {
            return value == null ? null : value.Value.ToString("0.000", CultureInfo.InvariantCulture);
        }

        private static string? FormatItem(string? lineNumber)
        {
            if (string.IsNullOrWhiteSpace(lineNumber))
            {
                return null;
            }

            return int.TryParse(lineNumber.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int number)
                ? number.ToString("00000", CultureInfo.InvariantCulture)
                : lineNumber.Trim();
        }
    }
}

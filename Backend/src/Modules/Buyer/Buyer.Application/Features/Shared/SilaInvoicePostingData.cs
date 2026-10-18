using System.Globalization;
using System.Text.Json;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The business values of one supplier-invoice post, stored on the invoice before SAP is called.
    /// A later send reads this document. It does not read the purchase order again.
    /// </summary>
    public static class SilaInvoicePostingData
    {
        public const string READY = "READY_TO_POST";
        public const string INVALID = "VALIDATION_FAILED";
        public const string STALE = "POSTING_DATA_STALE";
        public const string SOURCE_INVOICE = "INVOICE";
        public const string SOURCE_LINE = "INVOICE_LINE";
        public const string SOURCE_PO = "S4_PO_HEADER";
        public const string SOURCE_PO_ITEM = "S4_PO_ITEM";
        public const string SOURCE_GRN = "GRN";
        public const string SOURCE_CONFIGURATION = "CONFIGURATION";
        public const string SOURCE_CURRENT_DATE = "CURRENT_DATE";
        public const string SOURCE_DERIVED = "DERIVED";
        public const string SOURCE_MASTER = "MASTER";
        public const string SOURCE_LOCATION = "LOCATION";

        /// <summary>
        /// A_SupplierInvoice on API_SUPPLIERINVOICE_PROCESS_SRV. PO invoices send item TaxCode and
        /// TaxIsCalculatedAutomatically. to_SupplierInvoiceTax is the other tax shape and is not sent with it.
        /// FIVE S/4 has time-dependent taxes, so the header TaxDeterminationDate is stored from the invoice date.
        /// RE is the document type configured for FIVE S4-INVOICE POSTING.
        /// </summary>
        public const string DOCUMENT_TYPE = "RE";
        public const string TAX_AUTOMATIC = "true";

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
            /// <summary>PO or NON_PO. Selects the Supplier Invoice item navigation.</summary>
            public string InvoiceMode { get; set; } = Common.SILA_INVOICE_CREATION_PO;
            public string? PurchaseOrder { get; set; }
            public string? SourceApi { get; set; }
            public string? Fingerprint { get; set; }
            public List<Field> Header { get; set; } = new();
            public List<Line> Lines { get; set; } = new();
        }

        public sealed class Field
        {
            public string ApiField { get; set; } = string.Empty;
            public string Label { get; set; } = string.Empty;
            public string? Value { get; set; }
            public string Source { get; set; } = string.Empty;
            public string SourceField { get; set; } = string.Empty;
            public bool Required { get; set; }
        }

        public sealed class Line
        {
            public int InvoiceLine { get; set; }
            public Guid InvoiceItemId { get; set; }
            public string? GrnNumber { get; set; }
            public string? MaterialDocument { get; set; }
            public List<Field> Fields { get; set; } = new();
        }

        /// <summary>Writes the posting document onto the invoice. The purchase order is not copied; only the values the post uses.</summary>
        public static async Task StoreAsync(
            IRepositoryWrapper repository,
            Invoice invoice,
            SilaPurchaseOrderInvoiceRead.Order sapOrder,
            Guid userId,
            CancellationToken cancellationToken,
            IReadOnlyDictionary<Guid, SilaPurchaseOrderInvoiceRead.Order>? sapByPurchaseOrder = null,
            IReadOnlyDictionary<Guid, string>? poNumbers = null)
        {
            List<InvoiceItem> items = await repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToListAsync(cancellationToken);
            List<Guid> poItemIds = items.Where(x => x.PurchaseOrderItemId != null).Select(x => x.PurchaseOrderItemId!.Value).Distinct().ToList();
            List<PurchaseOrderItem> poItems = poItemIds.Count == 0
                ? new List<PurchaseOrderItem>()
                : await repository.PurchaseOrderItem.FindByCondition(x => poItemIds.Contains(x.Id)).ToListAsync(cancellationToken);
            List<GoodsReceipt> receipts = await repository.GoodsReceipt
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.BuyerId == invoice.BuyerId && x.IsActive)
                .ToListAsync(cancellationToken);
            List<Guid> receiptIds = receipts.Select(x => x.Id).ToList();
            List<GoodsReceiptItem> receiptItems = receiptIds.Count == 0
                ? new List<GoodsReceiptItem>()
                : await repository.GoodsReceiptItem.FindByCondition(x => receiptIds.Contains(x.GoodsReceiptId) && x.IsActive).ToListAsync(cancellationToken);
            List<Guid> postingIds = receipts.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            List<InventoryErpPosting> postings = postingIds.Count == 0
                ? new List<InventoryErpPosting>()
                : await repository.InventoryErpPosting.FindByCondition(x => postingIds.Contains(x.Id)).ToListAsync(cancellationToken);

            Guid? purchaseOrderSupplierId = invoice.PurchaseOrderId == null
                ? null
                : await repository.PurchaseOrder
                    .FindByCondition(x => x.Id == invoice.PurchaseOrderId)
                    .Select(x => (Guid?)x.SupplierId)
                    .FirstOrDefaultAsync(cancellationToken);
            string? supplierCode = await SilaReceivingRules.ErpSupplierCodeAsync(
                repository, purchaseOrderSupplierId, invoice.SupplierId, invoice.SilaSupplierId, cancellationToken);
            int version = (Read(invoice.PostingData)?.Version ?? 0) + 1;
            Prepared prepared = Compose(invoice, items, poItems, receipts, receiptItems, postings, sapOrder, userId, version, sapByPurchaseOrder, poNumbers, supplierCode);
            invoice.PostingData = Write(prepared);
            repository.Invoice.Update(invoice);
        }

        public static Prepared Compose(
            Invoice invoice,
            IReadOnlyList<InvoiceItem> items,
            IReadOnlyList<PurchaseOrderItem> poItems,
            IReadOnlyList<GoodsReceipt> receipts,
            IReadOnlyList<GoodsReceiptItem> receiptItems,
            IReadOnlyList<InventoryErpPosting> grnPostings,
            SilaPurchaseOrderInvoiceRead.Order sapOrder,
            Guid userId,
            int version,
            IReadOnlyDictionary<Guid, SilaPurchaseOrderInvoiceRead.Order>? sapByPurchaseOrder = null,
            IReadOnlyDictionary<Guid, string>? poNumbers = null,
            string? erpSupplierCode = null)
        {
            string? date = SapDate(invoice.InvoiceDate);
            bool currencyMismatch = !string.IsNullOrWhiteSpace(invoice.Currency)
                && !string.IsNullOrWhiteSpace(sapOrder.Currency)
                && !invoice.Currency.Trim().Equals(sapOrder.Currency.Trim(), StringComparison.OrdinalIgnoreCase);
            string? currency = currencyMismatch ? null : First(invoice.Currency, sapOrder.Currency);
            string? supplier = SilaReceivingRules.ErpCode(sapOrder.SupplierCode) ?? SilaReceivingRules.ErpCode(erpSupplierCode);
            Prepared prepared = new Prepared
            {
                Version = version < 1 ? 1 : version,
                PreparedAt = DateTime.UtcNow,
                PreparedBy = userId,
                PurchaseOrder = invoice.PoNumber?.Trim(),
                SourceApi = SilaInvoiceLifecycle.API_GET_PO,
                Fingerprint = Fingerprint(invoice, items)
            };
            prepared.Header.Add(FieldOf("CompanyCode", "Company code", sapOrder.CompanyCode, SOURCE_PO, "CompanyCode", true));
            prepared.Header.Add(FieldOf("DocumentDate", "Document date", date, SOURCE_INVOICE, "InvoiceDate", true));
            prepared.Header.Add(FieldOf("PostingDate", "Posting date", date, SOURCE_INVOICE, "InvoiceDate", true));
            if (SilaFiveInvoicePosting.TimeDependentTaxes(SilaInvoiceLifecycle.API_INVOICE))
            {
                prepared.Header.Add(FieldOf("TaxDeterminationDate", "Tax determination date", date, SOURCE_INVOICE, "InvoiceDate", true));
            }

            // No payment-term baseline date is stored. The invoice date is the due-calculation baseline.
            prepared.Header.Add(FieldOf("DueCalculationBaseDate", "Due calculation base date", date, SOURCE_INVOICE, "InvoiceDate", true));
            prepared.Header.Add(FieldOf("InvoicingParty", "Invoicing party", supplier, SOURCE_PO, "Supplier", true));
            prepared.Header.Add(FieldOf(
                "DocumentCurrency",
                currencyMismatch ? "Currency does not match the purchase order" : "Currency",
                currency,
                SOURCE_INVOICE,
                "Currency",
                true));
            prepared.Header.Add(FieldOf("InvoiceGrossAmount", "Gross amount", Money(invoice.GrossAmount), SOURCE_INVOICE, "GrossAmount", true));
            prepared.Header.Add(FieldOf("AccountingDocumentType", "Accounting document type", DOCUMENT_TYPE, SOURCE_CONFIGURATION, "AccountingDocumentType", true));
            prepared.Header.Add(FieldOf("TaxIsCalculatedAutomatically", "Automatic tax calculation", TAX_AUTOMATIC, SOURCE_CONFIGURATION, "TaxIsCalculatedAutomatically", true));
            prepared.Header.Add(FieldOf("SupplierInvoiceIDByInvcgParty", "Supplier invoice reference", invoice.InvoiceNumber?.Trim(), SOURCE_INVOICE, "InvoiceNumber", true));
            prepared.Header.Add(FieldOf("PurchaseOrder", "Purchase order", invoice.PoNumber?.Trim(), SOURCE_PO, "PurchaseOrder", false));
            prepared.Header.Add(FieldOf("NetAmount", "Net amount", Money(invoice.NetAmount), SOURCE_INVOICE, "NetAmount", false));
            prepared.Header.Add(FieldOf("TaxAmount", "Tax amount", Money(invoice.TaxAmount), SOURCE_INVOICE, "TaxAmount", false));

            int sequence = 0;
            foreach (InvoiceItem item in items.OrderBy(x => x.LineNumber))
            {
                PurchaseOrderItem? poItem = item.PurchaseOrderItemId == null
                    ? null
                    : poItems.FirstOrDefault(x => x.Id == item.PurchaseOrderItemId);
                SilaPurchaseOrderInvoiceRead.Order lineOrder = sapOrder;
                string? linePo = invoice.PoNumber?.Trim();
                if (poItem != null && sapByPurchaseOrder != null && sapByPurchaseOrder.TryGetValue(poItem.PurchaseOrderId, out SilaPurchaseOrderInvoiceRead.Order? specific))
                {
                    lineOrder = specific;
                    if (poNumbers != null && poNumbers.TryGetValue(poItem.PurchaseOrderId, out string? number) && !string.IsNullOrWhiteSpace(number))
                    {
                        linePo = number.Trim();
                    }
                }
                SilaPurchaseOrderInvoiceRead.Line? sapLine = poItem == null
                    ? null
                    : lineOrder.Lines.FirstOrDefault(x => SameItem(x.Item, poItem.LineNumber));
                List<GoodsReceiptItem> matchedReceipts = item.PurchaseOrderItemId == null
                    ? new List<GoodsReceiptItem>()
                    : receiptItems.Where(x => x.PurchaseOrderItemId == item.PurchaseOrderItemId).ToList();
                List<string> grnNumbers = matchedReceipts
                    .Select(x => receipts.FirstOrDefault(receipt => receipt.Id == x.GoodsReceiptId)?.GrnNumber)
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x!)
                    .Distinct()
                    .ToList();
                List<string> materialDocuments = matchedReceipts
                    .Select(x => receipts.FirstOrDefault(receipt => receipt.Id == x.GoodsReceiptId))
                    .Where(x => x?.ErpPostingId != null)
                    .Select(x => grnPostings.FirstOrDefault(posting => posting.Id == x!.ErpPostingId)?.ErpReference)
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Select(x => x!)
                    .Distinct()
                    .ToList();
                string? materialDocument = materialDocuments.Count == 0 ? null : string.Join(", ", materialDocuments);
                string? goodsReceipt = materialDocument ?? (grnNumbers.Count == 0 ? null : string.Join(", ", grnNumbers));
                sequence++;
                string? taxCode = sapLine?.TaxCode ?? poItem?.TaxCode;
                string? itemNumber = PoItem(sapLine?.Item, poItem?.LineNumber);
                string? uom = First(sapLine?.Uom, poItem?.UnitOfMeasure);
                Line line = new Line
                {
                    InvoiceLine = item.LineNumber,
                    InvoiceItemId = item.Id,
                    GrnNumber = grnNumbers.Count == 0 ? null : string.Join(", ", grnNumbers),
                    MaterialDocument = materialDocument
                };
                line.Fields.Add(FieldOf("SupplierInvoiceItem", "Item", sequence.ToString("00000", CultureInfo.InvariantCulture), SOURCE_DERIVED, "LineNumber", true));
                line.Fields.Add(FieldOf("PurchaseOrder", "PO", linePo, SOURCE_PO, "PurchaseOrder", true));
                line.Fields.Add(FieldOf("PurchaseOrderItem", "PO item", itemNumber, sapLine == null ? SOURCE_LINE : SOURCE_PO_ITEM, "PurchaseOrderItem", true));
                line.Fields.Add(FieldOf("DocumentCurrency", "Currency", currency, SOURCE_INVOICE, "Currency", true));
                line.Fields.Add(FieldOf("SupplierInvoiceItemAmount", "Amount", Money(item.Amount), SOURCE_LINE, "Amount", true));
                line.Fields.Add(FieldOf("QuantityInPurchaseOrderUnit", "Quantity", Quantity(item.Quantity), SOURCE_LINE, "Quantity", true));
                line.Fields.Add(FieldOf("PurchaseOrderQuantityUnit", "PO UOM", uom, SOURCE_PO_ITEM, "PurchaseOrderQuantityUnit", true));
                line.Fields.Add(FieldOf("TaxCode", "Tax code", taxCode, SOURCE_PO_ITEM, "TaxCode", true));
                line.Fields.Add(FieldOf("Material", "Material", sapLine?.Material ?? poItem?.MaterialCode, SOURCE_PO_ITEM, "Material", false));
                line.Fields.Add(FieldOf("Plant", "Plant", sapLine?.Plant ?? lineOrder.Plant, SOURCE_PO_ITEM, "Plant", false));
                line.Fields.Add(FieldOf("GrnNumber", "Goods receipt", goodsReceipt, SOURCE_GRN, "ErpReference", false));
                line.Fields.Add(FieldOf("MaterialDocument", "SAP material document", materialDocument, SOURCE_GRN, "ErpReference", false));
                prepared.Lines.Add(line);
            }

            prepared.PreparationStatus = Missing(prepared).Count == 0 ? READY : INVALID;
            return prepared;
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

        /// <summary>Mandatory body fields that are still empty. Posting does not start while this list has a row.</summary>
        public static List<string> Missing(Prepared? prepared)
        {
            List<string> missing = new List<string>();
            if (prepared == null)
            {
                missing.Add("Posting data is not stored. Refresh from S/4.");
                return missing;
            }

            if (prepared.Lines.Count == 0)
            {
                missing.Add("Invoice line, from the supplier invoice. At least one line is required.");
            }

            foreach (Field field in prepared.Header.Where(x => x.Required && string.IsNullOrWhiteSpace(x.Value)))
            {
                missing.Add(Gap(field, prepared.PurchaseOrder, null));
            }

            foreach (Line line in prepared.Lines)
            {
                string? poItem = Value(line.Fields, "PurchaseOrderItem");
                foreach (Field field in line.Fields.Where(x => x.Required && string.IsNullOrWhiteSpace(x.Value)))
                {
                    missing.Add(Gap(field, prepared.PurchaseOrder, poItem) + ", invoice line " + line.InvoiceLine.ToString(CultureInfo.InvariantCulture));
                }
            }

            return missing;
        }

        /// <summary>Why a retry must not call SAP. Ordinary reprocess does not read the purchase order again.</summary>
        public static string? BlockSend(Prepared? prepared, Invoice invoice, IReadOnlyList<InvoiceItem> items)
        {
            if (prepared == null || string.IsNullOrWhiteSpace(invoice.PostingData))
            {
                return "Posting data is not stored. Refresh from S/4. The purchase order is not read again during reprocess.";
            }

            if (prepared.PreparationStatus == STALE || Stale(prepared, invoice, items))
            {
                return "Posting data is stale because the invoice changed after it was prepared. Refresh from S/4. The purchase order is not read again during reprocess.";
            }

            List<string> missing = Missing(prepared);
            return missing.Count == 0 ? null : SilaInvoiceLifecycle.MISSING + ". " + string.Join("; ", missing);
        }

        public static bool Stale(Prepared prepared, Invoice invoice, IReadOnlyList<InvoiceItem> items)
        {
            return !string.Equals(prepared.Fingerprint, Fingerprint(invoice, items), StringComparison.Ordinal);
        }

        /// <summary>Keeps the stored values and marks them stale when an invoice field used in the body changes.</summary>
        public static void MarkChanged(Invoice invoice, IReadOnlyList<InvoiceItem> items)
        {
            Prepared? prepared = Read(invoice.PostingData);
            if (prepared == null || !Stale(prepared, invoice, items))
            {
                return;
            }

            prepared.PreparationStatus = STALE;
            invoice.PostingData = Write(prepared);
            if (invoice.Status == Common.SILA_INVOICE_READY_TO_POST)
            {
                invoice.Status = Common.SILA_INVOICE_VALIDATION_FAILED;
            }
        }

        /// <summary>
        /// FIVE keeps TaxDeterminationDate on the stored header, taken from the invoice date.
        /// A posting date that was stamped as "today" is put back on the invoice date. Nothing is taken from the clock.
        /// </summary>
        public static bool EnsureFiveHeader(Prepared prepared, DateTime? invoiceDate)
        {
            if (!SilaFiveInvoicePosting.TimeDependentTaxes(SilaInvoiceLifecycle.API_INVOICE))
            {
                return false;
            }

            string? date = SapDate(invoiceDate) ?? Value(prepared.Header, "DocumentDate");
            bool changed = false;
            Field? postingDate = prepared.Header.LastOrDefault(x => x.ApiField.Equals("PostingDate", StringComparison.OrdinalIgnoreCase));
            if (postingDate != null
                && string.Equals(postingDate.Source, SOURCE_CURRENT_DATE, StringComparison.Ordinal)
                && !string.IsNullOrWhiteSpace(date))
            {
                postingDate.Value = date;
                postingDate.Source = SOURCE_INVOICE;
                postingDate.SourceField = "InvoiceDate";
                changed = true;
            }

            Field? taxDate = prepared.Header.LastOrDefault(x => x.ApiField.Equals("TaxDeterminationDate", StringComparison.OrdinalIgnoreCase));
            if (taxDate == null)
            {
                Field field = FieldOf("TaxDeterminationDate", "Tax determination date", date, SOURCE_INVOICE, "InvoiceDate", true);
                int index = prepared.Header.FindIndex(x => x.ApiField.Equals("PostingDate", StringComparison.OrdinalIgnoreCase));
                if (index < 0)
                {
                    prepared.Header.Add(field);
                }
                else
                {
                    prepared.Header.Insert(index + 1, field);
                }

                changed = true;
            }
            else if (string.IsNullOrWhiteSpace(taxDate.Value) && !string.IsNullOrWhiteSpace(date))
            {
                taxDate.Value = date;
                taxDate.Label = "Tax determination date";
                taxDate.Source = SOURCE_INVOICE;
                taxDate.SourceField = "InvoiceDate";
                taxDate.Required = true;
                changed = true;
            }

            if (changed)
            {
                prepared.PreparationStatus = Missing(prepared).Count == 0 ? READY : INVALID;
            }

            return changed;
        }

        /// <summary>The request mapper's names, filled only from the stored document.</summary>
        public static SilaInvoicePosting.Document ToDocument(Prepared prepared)
        {
            SilaInvoicePosting.Document document = new SilaInvoicePosting.Document
            {
                CompanyCode = Value(prepared.Header, "CompanyCode"),
                Mode = string.IsNullOrWhiteSpace(prepared.InvoiceMode) ? Common.SILA_INVOICE_CREATION_PO : prepared.InvoiceMode
            };
            Add(document.Header, "CompanyCode", Value(prepared.Header, "CompanyCode"));
            Add(document.Header, "DocumentDate", Value(prepared.Header, "DocumentDate"));
            Add(document.Header, "PostingDate", Value(prepared.Header, "PostingDate"));
            Add(document.Header, "TaxDeterminationDate", Value(prepared.Header, "TaxDeterminationDate"));
            Add(document.Header, "DueCalculationBaseDate", Value(prepared.Header, "DueCalculationBaseDate"));
            Add(document.Header, "SupplierCode", Value(prepared.Header, "InvoicingParty"));
            Add(document.Header, "Currency", Value(prepared.Header, "DocumentCurrency"));
            Add(document.Header, "GrossAmount", Value(prepared.Header, "InvoiceGrossAmount"));
            Add(document.Header, "InvoiceNumber", Value(prepared.Header, "SupplierInvoiceIDByInvcgParty"));
            Add(document.Header, "PurchaseOrder", Value(prepared.Header, "PurchaseOrder"));
            Add(document.Header, "AccountingDocumentType", Value(prepared.Header, "AccountingDocumentType"));
            Add(document.Header, "TaxIsCalculatedAutomatically", Value(prepared.Header, "TaxIsCalculatedAutomatically"));
            Add(document.Header, "TaxAmount", Value(prepared.Header, "TaxAmount"));
            bool nonPo = SilaInvoiceCreation.IsNonPo(prepared.InvoiceMode);
            foreach (Line line in prepared.Lines)
            {
                List<(string Name, object? Value)> row = new List<(string Name, object? Value)>();
                Add(row, "SupplierInvoiceItem", Value(line.Fields, "SupplierInvoiceItem"));
                Add(row, "DocumentCurrency", Value(line.Fields, "DocumentCurrency"));
                Add(row, "Amount", Value(line.Fields, "SupplierInvoiceItemAmount"));
                Add(row, "TaxCode", Value(line.Fields, "TaxCode"));
                if (nonPo)
                {
                    Add(row, "CompanyCode", Value(line.Fields, "CompanyCode") ?? Value(prepared.Header, "CompanyCode"));
                    Add(row, "GLAccount", Value(line.Fields, "GLAccount"));
                    Add(row, "CostCenter", Value(line.Fields, "CostCenter"));
                    Add(row, "ProfitCenter", Value(line.Fields, "ProfitCenter"));
                    Add(row, "InternalOrder", Value(line.Fields, "InternalOrder"));
                    Add(row, "WBSElement", Value(line.Fields, "WBSElement"));
                    Add(row, "BusinessArea", Value(line.Fields, "BusinessArea"));
                    Add(row, "AssignmentReference", Value(line.Fields, "AssignmentReference"));
                    Add(row, "DebitCreditCode", Value(line.Fields, "DebitCreditCode"));
                    Add(row, "SupplierInvoiceItemText", Value(line.Fields, "SupplierInvoiceItemText"));
                }
                else
                {
                    Add(row, "PurchaseOrder", Value(line.Fields, "PurchaseOrder"));
                    Add(row, "PurchaseOrderItem", Value(line.Fields, "PurchaseOrderItem"));
                    Add(row, "Quantity", Value(line.Fields, "QuantityInPurchaseOrderUnit"));
                    Add(row, "Uom", Value(line.Fields, "PurchaseOrderQuantityUnit"));
                }

                document.Items.Add(row);
            }

            return document;
        }

        /// <summary>Persists Non-PO GL posting values from the invoice lines. Does not call FIVE S4 - GET PO.</summary>
        public static void StoreNonPo(
            Invoice invoice,
            IReadOnlyList<InvoiceItem> items,
            Guid userId,
            string? supplierCode,
            DateTime? postingDate = null,
            DateTime? taxDeterminationDate = null)
        {
            string? documentDate = invoice.InvoiceDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "T00:00:00";
            string? posted = (postingDate ?? invoice.InvoiceDate)?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "T00:00:00";
            string? taxDate = (taxDeterminationDate ?? invoice.InvoiceDate)?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "T00:00:00";
            Prepared prepared = new Prepared
            {
                Version = SilaInvoiceLifecycle.VERSION,
                PreparationStatus = READY,
                PreparedAt = DateTime.UtcNow,
                PreparedBy = userId,
                InvoiceMode = Common.SILA_INVOICE_CREATION_NON_PO,
                SourceApi = SilaInvoiceLifecycle.API_INVOICE,
                Fingerprint = Fingerprint(invoice, items)
            };
            prepared.Header.Add(FieldOf("CompanyCode", "Company code", invoice.CompanyCode, SOURCE_INVOICE, "CompanyCode", true));
            prepared.Header.Add(FieldOf("DocumentDate", "Document date", documentDate, SOURCE_INVOICE, "InvoiceDate", true));
            prepared.Header.Add(FieldOf("PostingDate", "Posting date", posted, SOURCE_INVOICE, "PostingDate", true));
            prepared.Header.Add(FieldOf("TaxDeterminationDate", "Tax determination date", taxDate, SOURCE_INVOICE, "TaxDeterminationDate", true));
            prepared.Header.Add(FieldOf("DueCalculationBaseDate", "Due calculation base date", documentDate, SOURCE_INVOICE, "InvoiceDate", true));
            prepared.Header.Add(FieldOf("InvoicingParty", "Invoicing party", supplierCode, SOURCE_MASTER, "SupplierCode", true));
            prepared.Header.Add(FieldOf("DocumentCurrency", "Currency", invoice.Currency, SOURCE_INVOICE, "Currency", true));
            prepared.Header.Add(FieldOf("InvoiceGrossAmount", "Gross amount", Money(invoice.GrossAmount), SOURCE_INVOICE, "GrossAmount", true));
            prepared.Header.Add(FieldOf("AccountingDocumentType", "Accounting document type", DOCUMENT_TYPE, SOURCE_CONFIGURATION, "AccountingDocumentType", true));
            prepared.Header.Add(FieldOf("TaxIsCalculatedAutomatically", "Automatic tax calculation", TAX_AUTOMATIC, SOURCE_CONFIGURATION, "TaxIsCalculatedAutomatically", true));
            prepared.Header.Add(FieldOf("SupplierInvoiceIDByInvcgParty", "Supplier invoice reference", invoice.InvoiceNumber?.Trim(), SOURCE_INVOICE, "InvoiceNumber", true));
            prepared.Header.Add(FieldOf("NetAmount", "Net amount", Money(invoice.NetAmount), SOURCE_INVOICE, "NetAmount", false));
            prepared.Header.Add(FieldOf("TaxAmount", "Tax amount", Money(invoice.TaxAmount), SOURCE_INVOICE, "TaxAmount", false));
            int sequence = 0;
            foreach (InvoiceItem item in items.OrderBy(x => x.LineNumber))
            {
                sequence++;
                Line line = new Line
                {
                    InvoiceLine = item.LineNumber,
                    InvoiceItemId = item.Id
                };
                line.Fields.Add(FieldOf("SupplierInvoiceItem", "Item", sequence.ToString("00000", CultureInfo.InvariantCulture), SOURCE_DERIVED, "LineNumber", true));
                line.Fields.Add(FieldOf("CompanyCode", "Company code", invoice.CompanyCode, SOURCE_INVOICE, "CompanyCode", true));
                line.Fields.Add(FieldOf("GLAccount", "GL account", item.GlAccount, SOURCE_LINE, "GlAccount", true));
                line.Fields.Add(FieldOf("DocumentCurrency", "Currency", invoice.Currency, SOURCE_INVOICE, "Currency", true));
                line.Fields.Add(FieldOf("SupplierInvoiceItemAmount", "Amount", Money(item.Amount), SOURCE_LINE, "Amount", true));
                line.Fields.Add(FieldOf("TaxCode", "Tax code", item.TaxCode, SOURCE_LINE, "TaxCode", true));
                line.Fields.Add(FieldOf("DebitCreditCode", "Debit/credit", item.DebitCreditCode ?? "S", SOURCE_LINE, "DebitCreditCode", true));
                line.Fields.Add(FieldOf("CostCenter", "Cost center", item.CostCenter, SOURCE_LINE, "CostCenter", false));
                line.Fields.Add(FieldOf("ProfitCenter", "Profit center", item.ProfitCenter, SOURCE_LINE, "ProfitCenter", false));
                line.Fields.Add(FieldOf("InternalOrder", "Internal order", item.InternalOrder, SOURCE_LINE, "InternalOrder", false));
                line.Fields.Add(FieldOf("WBSElement", "WBS element", item.WbsElement, SOURCE_LINE, "WbsElement", false));
                line.Fields.Add(FieldOf("BusinessArea", "Business area", item.BusinessArea, SOURCE_LINE, "BusinessArea", false));
                line.Fields.Add(FieldOf("AssignmentReference", "Assignment", item.AssignmentReference, SOURCE_LINE, "AssignmentReference", false));
                line.Fields.Add(FieldOf("SupplierInvoiceItemText", "Item text", item.LineText ?? item.Description, SOURCE_LINE, "LineText", false));
                prepared.Lines.Add(line);
            }

            EnsureFiveHeader(prepared, invoice.InvoiceDate);
            prepared.PreparationStatus = Missing(prepared).Count == 0 ? READY : INVALID;
            invoice.PostingData = Write(prepared);
        }

        /// <summary>Stores PO invoice posting values from local PO/GRN masters when Create Invoice has already selected them.</summary>
        public static async Task StoreFromLocalAsync(
            IRepositoryWrapper repository,
            Invoice invoice,
            IReadOnlyList<InvoiceItem> items,
            Guid userId,
            string? supplierCode,
            CancellationToken cancellationToken,
            DateTime? postingDate = null,
            DateTime? taxDeterminationDate = null)
        {
            PurchaseOrder? order = invoice.PurchaseOrderId == null
                ? null
                : await repository.PurchaseOrder.FindFirstByConditionAsync(x => x.Id == invoice.PurchaseOrderId && x.BuyerId == invoice.BuyerId);
            List<Guid> poItemIds = items.Where(x => x.PurchaseOrderItemId != null).Select(x => x.PurchaseOrderItemId!.Value).Distinct().ToList();
            List<PurchaseOrderItem> poItems = poItemIds.Count == 0
                ? new List<PurchaseOrderItem>()
                : await repository.PurchaseOrderItem.FindByCondition(x => poItemIds.Contains(x.Id)).ToListAsync(cancellationToken);
            List<GoodsReceipt> receipts = await repository.GoodsReceipt
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.BuyerId == invoice.BuyerId && x.IsActive)
                .ToListAsync(cancellationToken);
            List<Guid> postingIds = receipts.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            Dictionary<Guid, InventoryErpPosting> postings = postingIds.Count == 0
                ? new Dictionary<Guid, InventoryErpPosting>()
                : await repository.InventoryErpPosting.FindByCondition(x => postingIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            string? documentDate = invoice.InvoiceDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "T00:00:00";
            string? posted = (postingDate ?? invoice.InvoiceDate)?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "T00:00:00";
            string? taxDate = (taxDeterminationDate ?? invoice.InvoiceDate)?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) + "T00:00:00";
            string company = invoice.CompanyCode ?? order?.CompanyCode;
            string currency = invoice.Currency ?? order?.Currency;
            Prepared prepared = new Prepared
            {
                Version = SilaInvoiceLifecycle.VERSION,
                PreparationStatus = READY,
                PreparedAt = DateTime.UtcNow,
                PreparedBy = userId,
                InvoiceMode = Common.SILA_INVOICE_CREATION_PO,
                PurchaseOrder = invoice.PoNumber ?? order?.PoNumber,
                SourceApi = "LOCAL_PO_GRN",
                Fingerprint = Fingerprint(invoice, items)
            };
            prepared.Header.Add(FieldOf("CompanyCode", "Company code", company, SOURCE_PO, "CompanyCode", true));
            prepared.Header.Add(FieldOf("DocumentDate", "Document date", documentDate, SOURCE_INVOICE, "InvoiceDate", true));
            prepared.Header.Add(FieldOf("PostingDate", "Posting date", posted, SOURCE_INVOICE, "PostingDate", true));
            prepared.Header.Add(FieldOf("TaxDeterminationDate", "Tax determination date", taxDate, SOURCE_INVOICE, "TaxDeterminationDate", true));
            prepared.Header.Add(FieldOf("DueCalculationBaseDate", "Due calculation base date", documentDate, SOURCE_INVOICE, "InvoiceDate", true));
            prepared.Header.Add(FieldOf("InvoicingParty", "Invoicing party", supplierCode, SOURCE_PO, "Supplier", true));
            prepared.Header.Add(FieldOf("DocumentCurrency", "Currency", currency, SOURCE_INVOICE, "Currency", true));
            prepared.Header.Add(FieldOf("InvoiceGrossAmount", "Gross amount", Money(invoice.GrossAmount), SOURCE_INVOICE, "GrossAmount", true));
            prepared.Header.Add(FieldOf("AccountingDocumentType", "Accounting document type", DOCUMENT_TYPE, SOURCE_CONFIGURATION, "AccountingDocumentType", true));
            prepared.Header.Add(FieldOf("TaxIsCalculatedAutomatically", "Automatic tax calculation", TAX_AUTOMATIC, SOURCE_CONFIGURATION, "TaxIsCalculatedAutomatically", true));
            prepared.Header.Add(FieldOf("SupplierInvoiceIDByInvcgParty", "Supplier invoice reference", invoice.InvoiceNumber?.Trim(), SOURCE_INVOICE, "InvoiceNumber", true));
            prepared.Header.Add(FieldOf("PurchaseOrder", "Purchase order", invoice.PoNumber ?? order?.PoNumber, SOURCE_PO, "PurchaseOrder", false));
            int sequence = 0;
            foreach (InvoiceItem item in items.OrderBy(x => x.LineNumber))
            {
                sequence++;
                PurchaseOrderItem? poItem = item.PurchaseOrderItemId == null ? null : poItems.FirstOrDefault(x => x.Id == item.PurchaseOrderItemId);
                GoodsReceipt? receipt = receipts.FirstOrDefault(x => item.GoodsReceiptItemId != null);
                if (item.GoodsReceiptItemId != null)
                {
                    GoodsReceiptItem? grnLine = await repository.GoodsReceiptItem.FindFirstByConditionAsync(x => x.Id == item.GoodsReceiptItemId);
                    receipt = grnLine == null ? null : receipts.FirstOrDefault(x => x.Id == grnLine.GoodsReceiptId) ?? await repository.GoodsReceipt.FindFirstByConditionAsync(x => x.Id == grnLine.GoodsReceiptId);
                }

                string? materialDocument = receipt?.ErpPostingId != null && postings.TryGetValue(receipt.ErpPostingId.Value, out InventoryErpPosting? posting)
                    ? posting.ErpReference
                    : null;
                string? tax = item.TaxCode ?? poItem?.TaxCode;
                string? uom = item.Uom ?? poItem?.UnitOfMeasure;
                string? poItemNumber = poItem == null ? null : poItem.LineNumber.ToString("00000", CultureInfo.InvariantCulture);
                Line line = new Line
                {
                    InvoiceLine = item.LineNumber,
                    InvoiceItemId = item.Id,
                    GrnNumber = receipt?.GrnNumber,
                    MaterialDocument = materialDocument
                };
                line.Fields.Add(FieldOf("SupplierInvoiceItem", "Item", sequence.ToString("00000", CultureInfo.InvariantCulture), SOURCE_DERIVED, "LineNumber", true));
                line.Fields.Add(FieldOf("PurchaseOrder", "PO", invoice.PoNumber ?? order?.PoNumber, SOURCE_PO, "PurchaseOrder", true));
                line.Fields.Add(FieldOf("PurchaseOrderItem", "PO item", poItemNumber, SOURCE_PO_ITEM, "PurchaseOrderItem", true));
                line.Fields.Add(FieldOf("DocumentCurrency", "Currency", currency, SOURCE_INVOICE, "Currency", true));
                line.Fields.Add(FieldOf("SupplierInvoiceItemAmount", "Amount", Money(item.Amount), SOURCE_LINE, "Amount", true));
                line.Fields.Add(FieldOf("QuantityInPurchaseOrderUnit", "Quantity", Quantity(item.Quantity), SOURCE_LINE, "Quantity", true));
                line.Fields.Add(FieldOf("PurchaseOrderQuantityUnit", "PO UOM", uom, SOURCE_PO_ITEM, "PurchaseOrderQuantityUnit", true));
                line.Fields.Add(FieldOf("TaxCode", "Tax code", tax, SOURCE_PO_ITEM, "TaxCode", true));
                line.Fields.Add(FieldOf("GrnNumber", "Goods receipt", materialDocument ?? receipt?.GrnNumber, SOURCE_GRN, "ErpReference", false));
                line.Fields.Add(FieldOf("MaterialDocument", "SAP material document", materialDocument, SOURCE_GRN, "ErpReference", false));
                prepared.Lines.Add(line);
            }

            EnsureFiveHeader(prepared, invoice.InvoiceDate);
            prepared.PreparationStatus = Missing(prepared).Count == 0 ? READY : INVALID;
            invoice.PostingData = Write(prepared);
        }

        public static SilaInvoicePostingDataDto? ForScreen(Invoice invoice, IReadOnlyList<InvoiceItem> items)
        {
            Prepared? prepared = Read(invoice.PostingData);
            if (prepared == null)
            {
                return null;
            }

            bool stale = prepared.PreparationStatus == STALE || Stale(prepared, invoice, items);
            EnsureFiveHeader(prepared, invoice.InvoiceDate);
            return new SilaInvoicePostingDataDto
            {
                PreparationStatus = stale ? STALE : prepared.PreparationStatus,
                PreparedAt = prepared.PreparedAt,
                Version = prepared.Version,
                PurchaseOrder = prepared.PurchaseOrder,
                SourceApi = prepared.SourceApi,
                InvoiceMode = prepared.InvoiceMode,
                Stale = stale,
                Header = prepared.Header.Select(ToField).ToList(),
                Lines = prepared.Lines.Select(line => new SilaInvoicePostingLineDto
                {
                    InvoiceLine = line.InvoiceLine,
                    GrnNumber = line.GrnNumber,
                    MaterialDocument = line.MaterialDocument,                    Fields = line.Fields.Select(ToField).ToList()
                }).ToList()
            };
        }

        public static string Fingerprint(Invoice invoice, IReadOnlyList<InvoiceItem> items)
        {
            List<string> parts = new List<string>
            {
                invoice.InvoiceNumber?.Trim() ?? string.Empty,
                invoice.InvoiceDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture) ?? string.Empty,
                invoice.Currency?.Trim() ?? string.Empty,
                Money(invoice.GrossAmount) ?? string.Empty,
                Money(invoice.NetAmount) ?? string.Empty,
                Money(invoice.TaxAmount) ?? string.Empty,
                invoice.PoNumber?.Trim() ?? string.Empty
            };
            foreach (InvoiceItem item in items.OrderBy(x => x.LineNumber))
            {
                parts.Add(string.Join(":",
                    item.LineNumber.ToString(CultureInfo.InvariantCulture),
                    Quantity(item.Quantity) ?? string.Empty,
                    Money(item.Amount) ?? string.Empty,
                    item.PurchaseOrderItemId?.ToString("N") ?? string.Empty));
            }

            return string.Join("|", parts);
        }

        private static SilaInvoicePostingFieldDto ToField(Field field)
        {
            return new SilaInvoicePostingFieldDto
            {
                ApiField = field.ApiField,
                Label = field.Label,
                Value = field.Value,
                Source = field.Source,
                SourceField = field.SourceField,
                Required = field.Required
            };
        }

        private static Field FieldOf(string apiField, string label, string? value, string source, string sourceField, bool required)
        {
            return new Field
            {
                ApiField = apiField,
                Label = label,
                Value = string.IsNullOrWhiteSpace(value) ? null : value.Trim(),
                Source = source,
                SourceField = sourceField,
                Required = required
            };
        }

        private static string Gap(Field field, string? purchaseOrder, string? purchaseOrderItem)
        {
            if (field.ApiField.Equals("TaxCode", StringComparison.OrdinalIgnoreCase))
            {
                return "Field: TaxCode. PO: " + (purchaseOrder ?? "") + ". PO Item: " + (purchaseOrderItem ?? "");
            }

            if (field.ApiField.Equals("TaxDeterminationDate", StringComparison.OrdinalIgnoreCase))
            {
                return SilaFiveInvoicePosting.TAX_DATE_MISSING;
            }

            string text = field.Label + ", from " + SourceText(field.Source) + " (" + field.SourceField + ")";
            if (!string.IsNullOrWhiteSpace(purchaseOrder))
            {
                text += ", purchase order " + purchaseOrder;
            }

            if (!string.IsNullOrWhiteSpace(purchaseOrderItem))
            {
                text += ", purchase order item " + purchaseOrderItem;
            }

            return text;
        }

        private static string SourceText(string source)
        {
            return source switch
            {
                SOURCE_INVOICE => "the supplier invoice",
                SOURCE_LINE => "the supplier invoice line",
                SOURCE_PO => "S/4 purchase order",
                SOURCE_PO_ITEM => "S/4 purchase order item",
                SOURCE_GRN => "the goods receipt",
                SOURCE_CONFIGURATION => "the invoice posting configuration",
                SOURCE_CURRENT_DATE => "the current date",
                SOURCE_DERIVED => "the invoice date",
                _ => source
            };
        }

        private static string? Value(IEnumerable<Field> fields, string apiField)
        {
            return fields.LastOrDefault(x => x.ApiField.Equals(apiField, StringComparison.OrdinalIgnoreCase))?.Value;
        }

        private static void Add(List<(string Name, object? Value)> target, string name, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                target.Add((name, value));
            }
        }

        private static string? Money(decimal? amount)
        {
            return amount?.ToString("0.00", CultureInfo.InvariantCulture);
        }

        private static string? Quantity(decimal? amount)
        {
            return amount?.ToString("0.####", CultureInfo.InvariantCulture);
        }

        private static string? SapDate(DateTime? value)
        {
            return value?.ToString("yyyy-MM-dd'T'00:00:00", CultureInfo.InvariantCulture);
        }

        private static string? PoItem(string? item, int? lineNumber)
        {
            if (int.TryParse(item, NumberStyles.Integer, CultureInfo.InvariantCulture, out int number))
            {
                return number.ToString("00000", CultureInfo.InvariantCulture);
            }

            if (!string.IsNullOrWhiteSpace(item))
            {
                return item.Trim();
            }

            return lineNumber?.ToString("00000", CultureInfo.InvariantCulture);
        }

        private static string? First(params string?[] values)
        {
            return values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim();
        }

        private static bool SameItem(string? item, int lineNumber)
        {
            return int.TryParse(item, NumberStyles.Integer, CultureInfo.InvariantCulture, out int number) && number == lineNumber;
        }
    }
}

using System.Globalization;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Writes a successful reading onto the invoice. A re-read keeps every header field the user changed since the last
    /// reading (a field that differs from what that reading found) and keeps the lines of a reviewed invoice. The purchase
    /// order is matched by number, the supplier by the purchase order or the Supplier Master.
    /// </summary>
    public static class SilaInvoiceApply
    {
        private const int OCR_TEXT_LIMIT = 20000;
        private const int DESCRIPTION_LIMIT = 500;
        private static readonly string[] DateFormats = { "yyyy-MM-dd", "dd/MM/yyyy", "dd-MM-yyyy", "dd.MM.yyyy", "d/M/yyyy", "MM/dd/yyyy", "dd MMM yyyy", "d MMM yyyy", "dd-MMM-yyyy" };

        public static async Task ApplyAsync(
            IRepositoryWrapper repository, Invoice invoice, Guid buyerId, SilaInvoiceOcrResultDto result, SilaInvoiceOcrFieldsDto? previous,
            bool reread, decimal minimumConfidence, CancellationToken cancellationToken, bool detailedLines = true)
        {
            SilaInvoiceOcrFieldsDto found = result.Fields ?? new SilaInvoiceOcrFieldsDto();
            string text = result.Text ?? string.Empty;
            invoice.OcrText = text.Length > OCR_TEXT_LIMIT ? text[..OCR_TEXT_LIMIT] : text;
            invoice.OcrConfidence = result.Confidence;

            bool keepNumber = reread && Edited(invoice.InvoiceNumber, previous?.InvoiceNumber);
            bool keepDate = reread && Edited(invoice.InvoiceDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), ParseDate(previous?.InvoiceDate)?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            bool keepCurrency = reread && Edited(invoice.Currency, previous?.Currency);
            bool keepGross = reread && Edited(invoice.GrossAmount?.ToString(CultureInfo.InvariantCulture), previous?.GrossAmount?.ToString(CultureInfo.InvariantCulture));
            bool keepSupplier = reread && (Edited(invoice.SupplierName, previous?.SupplierName) || invoice.SilaSupplierId != null);
            bool keepPo = reread && (Edited(invoice.PoNumber, previous?.PoNumber) || invoice.PurchaseOrderId != null);

            invoice.InvoiceNumber = keepNumber ? invoice.InvoiceNumber : Clean(found.InvoiceNumber);
            invoice.InvoiceDate = keepDate ? invoice.InvoiceDate : ParseDate(found.InvoiceDate);
            invoice.Currency = keepCurrency ? invoice.Currency : Clean(found.Currency)?.ToUpperInvariant();
            invoice.GrossAmount = keepGross ? invoice.GrossAmount : found.GrossAmount;

            // Net, tax, type and supplier tax number: a re-read keeps a value the user changed since the last reading.
            bool keepNet = reread && Edited(invoice.NetAmount?.ToString(CultureInfo.InvariantCulture), previous?.NetAmount?.ToString(CultureInfo.InvariantCulture));
            bool keepTax = reread && Edited(invoice.TaxAmount?.ToString(CultureInfo.InvariantCulture), previous?.TaxAmount?.ToString(CultureInfo.InvariantCulture));
            bool keepType = reread && Edited(invoice.InvoiceType, previous?.InvoiceType);
            bool keepTrn = reread && Edited(invoice.SupplierTaxNumber, previous?.SupplierTaxNumber);
            invoice.NetAmount = keepNet ? invoice.NetAmount : found.NetAmount;
            invoice.TaxAmount = keepTax ? invoice.TaxAmount : found.TaxAmount;
            invoice.InvoiceType = keepType ? invoice.InvoiceType : InvoiceType(found.InvoiceType);
            invoice.SupplierTaxNumber = keepTrn ? invoice.SupplierTaxNumber : Limit(Clean(found.SupplierTaxNumber), TAX_NUMBER_LIMIT);

            PurchaseOrder? purchaseOrder = null;
            if (!keepPo)
            {
                invoice.PoNumber = Clean(found.PoNumber);
                invoice.PurchaseOrderId = null;
                if (invoice.PoNumber != null)
                {
                    string poNumber = invoice.PoNumber;
                    purchaseOrder = await repository.PurchaseOrder
                        .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.PoNumber == poNumber)
                        .FirstOrDefaultAsync(cancellationToken);
                    invoice.PurchaseOrderId = purchaseOrder?.Id;
                }
            }

            if (!keepSupplier)
            {
                await MatchSupplierAsync(repository, invoice, buyerId, purchaseOrder, Clean(found.SupplierName), found.SupplierTaxNumber, cancellationToken);
            }

            bool keepLines = (reread && invoice.Status == Common.SILA_INVOICE_REVIEWED) || !detailedLines;
            if (!keepLines)
            {
                await ReplaceLinesAsync(repository, invoice, result.Lines, cancellationToken);
            }

            if (!(reread && invoice.Status == Common.SILA_INVOICE_REVIEWED))
            {
                invoice.Status = result.Confidence != null && result.Confidence < minimumConfidence
                    ? SilaOcrSettings.INVOICE_REVIEW_REQUIRED
                    : Common.SILA_INVOICE_EXTRACTED;
            }
        }

        private static async Task MatchSupplierAsync(
            IRepositoryWrapper repository, Invoice invoice, Guid buyerId, PurchaseOrder? purchaseOrder, string? name, string? taxNumber, CancellationToken cancellationToken)
        {
            invoice.SupplierName = name;
            invoice.SupplierId = null;
            invoice.SilaSupplierId = null;
            if (purchaseOrder != null)
            {
                invoice.SupplierId = purchaseOrder.SupplierId;
                invoice.SupplierName = purchaseOrder.SupplierName ?? name;
            }

            List<SilaInvoiceSupplierCandidateDto> candidates = await SilaInvoiceMatching.CandidatesAsync(repository, buyerId, invoice.SupplierName, taxNumber, cancellationToken);
            SilaInvoiceSupplierCandidateDto? best = candidates.FirstOrDefault();
            if (best == null || best.Score < SilaInvoiceMatching.AUTO_MATCH_SCORE)
            {
                return;
            }

            // Two equally good candidates are left for the user to choose.
            if (candidates.Count > 1 && candidates[1].Score == best.Score && purchaseOrder == null)
            {
                return;
            }

            invoice.SilaSupplierId = best.SilaSupplierId;
            invoice.SupplierId ??= best.SupplierId;
            invoice.SupplierName = purchaseOrder?.SupplierName ?? best.Name;
        }

        private static async Task ReplaceLinesAsync(IRepositoryWrapper repository, Invoice invoice, List<SilaInvoiceOcrLineDto>? lines, CancellationToken cancellationToken)
        {
            List<PurchaseOrderItem> poItems = invoice.PurchaseOrderId == null
                ? new List<PurchaseOrderItem>()
                : await repository.PurchaseOrderItem.FindByCondition(x => x.PurchaseOrderId == invoice.PurchaseOrderId.Value && x.IsActive).ToListAsync(cancellationToken);
            await SilaReceivingRules.DeactivateInvoiceItemsAsync(repository, invoice.Id, cancellationToken);
            int lineNumber = 0;
            foreach (SilaInvoiceOcrLineDto line in lines ?? new List<SilaInvoiceOcrLineDto>())
            {
                string? description = Clean(line.Description);
                if (description == null)
                {
                    continue;
                }

                lineNumber++;
                Guid? suggested = SilaInvoiceMatching.MatchLine(description, poItems);
                repository.InvoiceItem.Create(new InvoiceItem
                {
                    Id = Guid.NewGuid(),
                    InvoiceId = invoice.Id,
                    LineNumber = lineNumber,
                    Description = description.Length > DESCRIPTION_LIMIT ? description[..DESCRIPTION_LIMIT] : description,
                    Quantity = line.Quantity,
                    UnitPrice = line.UnitPrice,
                    Amount = line.Amount,
                    PurchaseOrderItemId = suggested,
                    Uom = Limit(Clean(line.Uom)?.ToUpperInvariant(), CODE_LIMIT),
                    SupplierMaterialCode = Limit(Clean(line.SupplierMaterialCode), CODE_LIMIT),
                    TaxRate = line.TaxRate is >= 0 and <= 100 ? line.TaxRate : null,
                    MatchStatus = suggested == null ? SilaReceivingRules.MATCH_UNMATCHED : SilaReceivingRules.MATCH_SUGGESTED,
                    IsActive = true
                });
            }
        }

        // A field the user changed: it differs from what the last reading found (any value counts when there was no reading).
        private static bool Edited(string? current, string? found)
        {
            string left = (current ?? string.Empty).Trim();
            return left.Length > 0 && !string.Equals(left, (found ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase);
        }

        public static DateTime? ParseDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return DateTime.TryParseExact(value.Trim(), DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out DateTime date) ? date.Date : null;
        }

        private const int TAX_NUMBER_LIMIT = 50;
        private const int CODE_LIMIT = 50;

        /// <summary>MATERIAL, SERVICE or MIXED; anything else is unknown (null).</summary>
        public static string? InvoiceType(string? value)
        {
            string? type = Clean(value)?.ToUpperInvariant();
            return type == SilaReceivingRules.INVOICE_MATERIAL || type == SilaReceivingRules.INVOICE_SERVICE || type == SilaReceivingRules.INVOICE_MIXED
                ? type
                : null;
        }

        private static string? Limit(string? value, int limit)
        {
            return value == null || value.Length <= limit ? value : value[..limit];
        }

        private static string? Clean(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
    }
}

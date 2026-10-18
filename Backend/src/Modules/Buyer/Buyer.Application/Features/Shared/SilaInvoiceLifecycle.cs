using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The invoice continues from its goods receipt. Supplier invoice values stay on the invoice.
    /// The purchase order and the goods receipt only supply the ERP and receipt references.
    /// </summary>
    public static class SilaInvoiceLifecycle
    {
        public const string API_GET_PO = "FIVE S4 - GET PO";
        public const string API_INVOICE = "FIVE S4-INVOICE POSTING";
        public const string API_ATTACHMENT = "API_CV_ATTACHMENT_SRV";
        public const string API_ATTACHMENT_LEGACY = "FIVE S4 - INVOICE ATTACHMENT";
        public const string ATTACHMENT_SERVICE = "API_CV_ATTACHMENT_SRV";
        public const string ATTACHMENT_PATH = "/sap/opu/odata/sap/API_CV_ATTACHMENT_SRV/CreateUrlAsAttachment";
        public const string BUSINESS_OBJECT = "BUS2081";
        public const string BUSINESS_OBJECT_LABEL = "Supplier Invoice";
        public const string MISSING = "INVOICE_POSTING_REQUIRED_FIELD_MISSING";
        public const int VERSION = 1;

        public static readonly string[] PostedStatuses =
        {
            Common.SILA_INVOICE_POSTED,
            Common.SILA_INVOICE_AWAITING_PAYMENT,
            Common.SILA_INVOICE_PARTIALLY_PAID,
            Common.SILA_INVOICE_PAID,
            Common.SILA_INVOICE_OVERDUE,
            Common.SILA_INVOICE_LOCAL_FAILED
        };

        public static List<string> Missing(Invoice invoice, IReadOnlyCollection<InvoiceItem> items, bool grnRequired, bool grnPosted, string? companyCode)
        {
            List<string> missing = new List<string>();
            if (string.IsNullOrWhiteSpace(invoice.InvoiceNumber))
            {
                missing.Add("Supplier invoice number, from the SILA invoice");
            }

            if (invoice.InvoiceDate == null)
            {
                missing.Add("Invoice date, from the SILA invoice");
            }

            if (invoice.SilaSupplierId == null && invoice.SupplierId == null && string.IsNullOrWhiteSpace(invoice.SupplierName))
            {
                missing.Add("Supplier, from the SILA invoice");
            }

            if (invoice.PurchaseOrderId == null || string.IsNullOrWhiteSpace(invoice.PoNumber))
            {
                missing.Add("Matched purchase order, from the SILA invoice");
            }

            if (invoice.GrossAmount == null && invoice.NetAmount == null)
            {
                missing.Add("Invoice amount, from the SILA invoice");
            }

            if (string.IsNullOrWhiteSpace(invoice.Currency))
            {
                missing.Add("Currency, from the SILA invoice");
            }

            if (string.IsNullOrWhiteSpace(companyCode))
            {
                missing.Add("Company code, from the purchase order");
            }

            if (items.Count == 0 || items.All(x => x.Quantity == null || x.Quantity <= 0))
            {
                missing.Add("Invoice quantity, from the SILA invoice lines");
            }

            if (grnRequired && !grnPosted)
            {
                missing.Add("Posted goods receipt, from the GRN");
            }

            return missing;
        }

        /// <summary>
        /// Placeholders in the invoice API body that have no value. {{items}} is the line array and is not a single field.
        /// </summary>
        public static List<string> MissingContract(string? template, IReadOnlyDictionary<string, string?> values)
        {
            List<string> missing = new List<string>();
            if (string.IsNullOrWhiteSpace(template))
            {
                return missing;
            }

            foreach (System.Text.RegularExpressions.Match match in System.Text.RegularExpressions.Regex.Matches(template, @"\{\{\s*([A-Za-z0-9_]+)\s*\}\}"))
            {
                string name = match.Groups[1].Value;
                if (name.Equals("items", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!values.TryGetValue(name, out string? value) || string.IsNullOrWhiteSpace(value))
                {
                    missing.Add(name + " — expected from the SILA invoice, FIVE S4 - GET PO, or the GRN");
                }
            }

            return missing.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }

        /// <summary>The invoice can be submitted. An open or accepted ERP posting cannot be submitted again.</summary>
        public static bool CanSubmit(string? status, bool serviceInvoice, bool grnConfirmed, bool postingOpen, bool alreadyPosted)
        {
            if (alreadyPosted || postingOpen || string.IsNullOrWhiteSpace(status))
            {
                return false;
            }

            if (status == Common.SILA_INVOICE_READY)
            {
                return true;
            }

            if (serviceInvoice && status == Common.SILA_INVOICE_REVIEWED)
            {
                return true;
            }

            if (grnConfirmed && status is Common.SILA_INVOICE_GRN_POSTED or Common.SILA_INVOICE_REVIEWED or Common.SILA_INVOICE_EXTRACTED or Common.SILA_INVOICE_READY)
            {
                return true;
            }

            return status is Common.SILA_INVOICE_VALIDATION_FAILED or Common.SILA_INVOICE_GET_PO_FAILED
                or Common.SILA_INVOICE_APPROVAL_REJECTED or Common.SILA_INVOICE_APPROVED or Common.SILA_INVOICE_READY_TO_POST;
        }

        public static bool AlreadyPosted(string? status, string? erpReference)
        {
            return !string.IsNullOrWhiteSpace(erpReference) || PostedStatuses.Contains(status ?? string.Empty);
        }

        public static List<SilaInvoiceStepDto> Timeline(
            string status,
            bool supplierMatched,
            bool poMatched,
            bool grnApplicable,
            bool grnExists,
            bool grnPosted,
            bool grnPdf,
            string? erpStatus,
            string? attachmentStatus = null)
        {
            string Step(bool done, bool failed) => failed ? "FAILED" : done ? "SUCCESS" : "NOT_STARTED";
            bool submitted = status is Common.SILA_INVOICE_PENDING_APPROVAL or Common.SILA_INVOICE_APPROVED or Common.SILA_INVOICE_READY_TO_POST
                or Common.SILA_INVOICE_POSTING or Common.SILA_INVOICE_POSTED or Common.SILA_INVOICE_POSTING_FAILED
                or Common.SILA_INVOICE_LOCAL_FAILED or Common.SILA_INVOICE_POSTING_UNKNOWN or Common.SILA_INVOICE_AWAITING_PAYMENT
                or Common.SILA_INVOICE_PARTIALLY_PAID or Common.SILA_INVOICE_PAID or Common.SILA_INVOICE_OVERDUE
                or Common.SILA_INVOICE_APPROVAL_REJECTED or Common.SILA_INVOICE_GET_PO_FAILED;
            bool approved = status is Common.SILA_INVOICE_APPROVED or Common.SILA_INVOICE_READY_TO_POST or Common.SILA_INVOICE_POSTING
                or Common.SILA_INVOICE_POSTED or Common.SILA_INVOICE_AWAITING_PAYMENT or Common.SILA_INVOICE_PARTIALLY_PAID
                or Common.SILA_INVOICE_PAID or Common.SILA_INVOICE_OVERDUE or Common.SILA_INVOICE_LOCAL_FAILED
                or Common.SILA_INVOICE_POSTING_FAILED or Common.SILA_INVOICE_POSTING_UNKNOWN or Common.SILA_INVOICE_GET_PO_FAILED;
            bool erpSuccess = erpStatus is Common.SILA_POSTING_POSTED or Common.SILA_POSTING_ERP_ACCEPTED or Common.SILA_POSTING_FAILED_LOCAL
                || status is Common.SILA_INVOICE_AWAITING_PAYMENT or Common.SILA_INVOICE_POSTED or Common.SILA_INVOICE_LOCAL_FAILED
                or Common.SILA_INVOICE_PARTIALLY_PAID or Common.SILA_INVOICE_PAID or Common.SILA_INVOICE_OVERDUE;
            bool localSuccess = status is Common.SILA_INVOICE_AWAITING_PAYMENT or Common.SILA_INVOICE_POSTED
                or Common.SILA_INVOICE_PARTIALLY_PAID or Common.SILA_INVOICE_PAID or Common.SILA_INVOICE_OVERDUE;
            return new List<SilaInvoiceStepDto>
            {
                new() { Step = "INVOICE RECEIVED", Status = "SUCCESS" },
                new() { Step = "OCR", Status = Step(status != Common.SILA_INVOICE_UPLOADED, status == Common.SILA_INVOICE_OCR_FAILED) },
                new() { Step = "SUPPLIER MATCH", Status = Step(supplierMatched, false) },
                new() { Step = "PO MATCH", Status = Step(poMatched, false) },
                new() { Step = "GRN", Status = grnApplicable ? Step(grnExists, false) : "NOT_STARTED" },
                new() { Step = "GRN POSTED", Status = grnApplicable ? Step(grnPosted, status == Common.SILA_INVOICE_GRN_FAILED) : "NOT_STARTED" },
                new() { Step = "GRN PDF", Status = grnApplicable ? Step(grnPdf, false) : "NOT_STARTED" },
                new() { Step = "INVOICE SUBMITTED", Status = Step(submitted, status == Common.SILA_INVOICE_VALIDATION_FAILED) },
                new() { Step = "APPROVAL", Status = Step(approved, status == Common.SILA_INVOICE_APPROVAL_REJECTED) },
                new() { Step = "S/4 INVOICE POSTING", Status = Step(erpSuccess, status == Common.SILA_INVOICE_POSTING_FAILED || status == Common.SILA_INVOICE_GET_PO_FAILED || erpStatus == Common.SILA_POSTING_FAILED) },
                new() { Step = "LOCAL FINALIZATION", Status = Step(localSuccess, status == Common.SILA_INVOICE_LOCAL_FAILED || erpStatus == Common.SILA_POSTING_FAILED_LOCAL) },
                new() { Step = "S/4 INVOICE ATTACHMENT", Status = localSuccess ? AttachmentStep(attachmentStatus) : "NOT_STARTED" },
                new() { Step = "PAYMENT", Status = status is Common.SILA_INVOICE_PAID ? "SUCCESS" : status is Common.SILA_INVOICE_AWAITING_PAYMENT or Common.SILA_INVOICE_PARTIALLY_PAID or Common.SILA_INVOICE_OVERDUE ? "PENDING" : "NOT_STARTED" }
            };
        }

        /// <summary>The attachment step. A failed attachment does not change the invoice posting step.</summary>
        public static string AttachmentStep(string? attachmentStatus)
        {
            return attachmentStatus switch
            {
                Common.SILA_POSTING_POSTED or Common.SILA_POSTING_ERP_ACCEPTED => "SUCCESS",
                Common.SILA_POSTING_FAILED or Common.SILA_POSTING_SKIPPED or Common.SILA_POSTING_FAILED_LOCAL => "FAILED",
                Common.SILA_POSTING_UNKNOWN => "UNKNOWN",
                Common.SILA_POSTING_PENDING => "PENDING",
                _ => "NOT_STARTED"
            };
        }
    }
}

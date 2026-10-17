using System.Text;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;

namespace Buyer.Tests.Shared
{
    /// <summary>
    /// Invoice posting keeps supplier invoice values, stops when a required field is missing, and does not
    /// mark SAP success before the ERP has accepted the document.
    /// </summary>
    public class SilaInvoiceLifecycleTests
    {
        [Fact]
        public void Missing_NamesTheInvoiceSource()
        {
            Invoice invoice = new Invoice { Currency = "AED", GrossAmount = 10 };
            List<string> missing = SilaInvoiceLifecycle.Missing(invoice, new List<InvoiceItem>(), true, false, null);

            Assert.Contains(missing, x => x.Contains("Supplier invoice number", StringComparison.Ordinal));
            Assert.Contains(missing, x => x.Contains("from the SILA invoice", StringComparison.Ordinal));
            Assert.Contains(missing, x => x.Contains("Company code", StringComparison.Ordinal));
            Assert.Contains(missing, x => x.Contains("from the GRN", StringComparison.Ordinal));
        }

        [Fact]
        public void Missing_DoesNotReplaceInvoiceQuantityWithThePurchaseOrder()
        {
            Invoice invoice = new Invoice
            {
                InvoiceNumber = "INV-1",
                InvoiceDate = new DateTime(2026, 10, 1),
                SupplierName = "Supplier",
                PurchaseOrderId = Guid.NewGuid(),
                PoNumber = "4500001",
                GrossAmount = 80,
                Currency = "AED"
            };
            List<InvoiceItem> items = new List<InvoiceItem> { new InvoiceItem { Quantity = 80 } };

            List<string> missing = SilaInvoiceLifecycle.Missing(invoice, items, true, true, "1050");

            Assert.Empty(missing);
        }

        [Fact]
        public void AlreadyPosted_IsTrueWhenSapReferenceExists()
        {
            Assert.True(SilaInvoiceLifecycle.AlreadyPosted(Common.SILA_INVOICE_POSTING, "5100001234"));
            Assert.False(SilaInvoiceLifecycle.AlreadyPosted(Common.SILA_INVOICE_READY, null));
        }

        [Fact]
        public void CanSubmit_WaitsForConfirmedGrnAndDoesNotRepeatAPostedInvoice()
        {
            Assert.False(SilaInvoiceLifecycle.CanSubmit(Common.SILA_INVOICE_GRN_IN_PROGRESS, false, false, false, false));
            Assert.True(SilaInvoiceLifecycle.CanSubmit(Common.SILA_INVOICE_READY, false, true, false, false));
            Assert.False(SilaInvoiceLifecycle.CanSubmit(Common.SILA_INVOICE_READY, false, true, false, true));
            Assert.True(SilaInvoiceLifecycle.CanSubmit(Common.SILA_INVOICE_REVIEWED, true, false, false, false));
        }

        [Fact]
        public void Timeline_DoesNotMarkPostingSuccessBeforeErp()
        {
            var steps = SilaInvoiceLifecycle.Timeline(Common.SILA_INVOICE_READY, true, true, true, true, true, true, null);
            Assert.Equal("SUCCESS", steps.Single(x => x.Step == "GRN POSTED").Status);
            Assert.Equal("NOT_STARTED", steps.Single(x => x.Step == "S/4 INVOICE POSTING").Status);
            Assert.Equal("NOT_STARTED", steps.Single(x => x.Step == "PAYMENT").Status);
        }

        [Fact]
        public void Timeline_LocalFailureStaysFailedAndKeepsErpSuccess()
        {
            var steps = SilaInvoiceLifecycle.Timeline(Common.SILA_INVOICE_LOCAL_FAILED, true, true, true, true, true, true, Common.SILA_POSTING_FAILED_LOCAL);
            Assert.Equal("SUCCESS", steps.Single(x => x.Step == "S/4 INVOICE POSTING").Status);
            Assert.Equal("FAILED", steps.Single(x => x.Step == "LOCAL FINALIZATION").Status);
        }

        [Fact]
        public void MissingContract_StopsWhenTheApiNeedsAValueThatIsNotThere()
        {
            Dictionary<string, string?> values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            {
                ["invoiceNumber"] = "INV-1",
                ["taxCode"] = null
            };

            List<string> missing = SilaInvoiceLifecycle.MissingContract("{\"SupplierInvoice\":\"{{invoiceNumber}}\",\"TaxCode\":\"{{taxCode}}\",\"Items\":{{items}}}", values);

            Assert.DoesNotContain(missing, x => x.StartsWith("invoiceNumber", StringComparison.OrdinalIgnoreCase));
            Assert.Contains(missing, x => x.StartsWith("taxCode", StringComparison.OrdinalIgnoreCase));
            Assert.DoesNotContain(missing, x => x.StartsWith("items", StringComparison.OrdinalIgnoreCase));
        }

        [Fact]
        public void SameSupplier_UsesSupplierIdNotTheSupplierName()
        {
            Guid supplier = Guid.Parse("622df099-7eca-4f4a-93e9-5b8fd948ebc9");
            Invoice posted = new Invoice { SupplierId = supplier, InvoiceNumber = "TESTINVOICE123", SupplierName = "Other name" };
            Invoice again = new Invoice { SilaSupplierId = supplier, InvoiceNumber = "TESTINVOICE123", SupplierName = "TEST SBN" };
            Invoice otherSupplier = new Invoice { SupplierId = Guid.NewGuid(), InvoiceNumber = "TESTINVOICE123", SupplierName = "TEST SBN" };

            Assert.True(SilaInvoicePosting.SameSupplier(posted, again));
            Assert.False(SilaInvoicePosting.SameSupplier(posted, otherSupplier));
        }

        [Fact]
        public void SupplierInvoiceRequest_UsesTheInvoiceQuantityAndNotTheSampleBody()
        {
            SilaInvoicePosting.Document document = new SilaInvoicePosting.Document();
            document.Header.Add(("InvoiceNumber", "TESTINVOICE123"));
            document.Header.Add(("DocumentDate", "2026-10-12"));
            document.Header.Add(("SupplierCode", "1003430"));
            document.Header.Add(("PurchaseOrder", "4500004152"));
            document.Header.Add(("CompanyCode", "1050"));
            document.Header.Add(("Currency", "AED"));
            document.Header.Add(("GrossAmount", 47200m));
            document.Items.Add(new List<(string Name, object? Value)>
            {
                ("PurchaseOrder", "4500004152"),
                ("PurchaseOrderItem", "00010"),
                ("Quantity", 10m),
                ("Uom", "EA"),
                ("Amount", 45700m)
            });
            string template = """
                {
                  "CompanyCode": "3000",
                  "DocumentDate": "2025-10-21T00:00",
                  "PostingDate": "2025-10-21T00:00",
                  "InvoicingParty": "1000569",
                  "DocumentCurrency": "AED",
                  "InvoiceGrossAmount": "301.30",
                  "AccountingDocumentType": "RE",
                  "SupplierInvoiceIDByInvcgParty": "002",
                  "ReconciliationAccount": "4000000000",
                  "to_SuplrInvcItemPurOrdRef": { "results": [ { "PurchaseOrder": "4500001161", "QuantityInPurchaseOrderUnit": "1" } ] },
                  "to_SupplierInvoiceItemGLAcct": { "results": [ { "GLAccount": "6270000011", "SupplierInvoiceItemAmount": "50.00" } ] }
                }
                """;

            (string? body, List<string> missing) = SilaInvoicePosting.SupplierInvoiceRequest(template, document);

            Assert.Empty(missing);
            Assert.NotNull(body);
            Assert.Contains("\"CompanyCode\":\"1050\"", body, StringComparison.Ordinal);
            Assert.Contains("\"InvoicingParty\":\"1003430\"", body, StringComparison.Ordinal);
            Assert.Contains("\"SupplierInvoiceIDByInvcgParty\":\"TESTINVOICE123\"", body, StringComparison.Ordinal);
            Assert.Contains("\"QuantityInPurchaseOrderUnit\":\"10\"", body, StringComparison.Ordinal);
            Assert.Contains("\"PurchaseOrder\":\"4500004152\"", body, StringComparison.Ordinal);
            Assert.DoesNotContain("3000", body, StringComparison.Ordinal);
            Assert.DoesNotContain("4000000000", body, StringComparison.Ordinal);
            Assert.DoesNotContain("6270000011", body, StringComparison.Ordinal);
            Assert.Contains("\"AccountingDocumentType\":\"RE\"", body, StringComparison.Ordinal);
        }

        [Fact]
        public void GrnPdf_IsAPdfDocument()
        {
            byte[] pdf = SilaGrnDocument.Pdf(new List<string> { "GRN GRN000001", "PO 4500001" });

            Assert.StartsWith("%PDF", Encoding.ASCII.GetString(pdf));
        }
    }
}

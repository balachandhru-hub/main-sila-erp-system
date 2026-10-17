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
        public void GrnPdf_IsAPdfDocument()
        {
            byte[] pdf = SilaGrnDocument.Pdf(new List<string> { "GRN GRN000001", "PO 4500001" });

            Assert.StartsWith("%PDF", Encoding.ASCII.GetString(pdf));
        }
    }
}

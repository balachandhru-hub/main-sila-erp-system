using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;

namespace Buyer.Tests.Shared
{
    /// <summary>
    /// The attachment key, document address and FunctionImport path are built from stored invoice-posting values.
    /// A failed attachment does not change a successful invoice posting.
    /// </summary>
    public class SilaInvoiceAttachmentTests
    {
        [Fact]
        public void LinkedKey_JoinsTheSapInvoiceNumberAndFiscalYearWithNoSeparator()
        {
            Assert.Equal("51056040192024", SilaInvoiceAttachment.LinkedKey("5105604019", "2024"));
            Assert.Equal("51056040192024", SilaInvoiceAttachment.LinkedKey(" 5105604019 ", "2024"));
            Assert.Equal("051056040192024", SilaInvoiceAttachment.LinkedKey("05105604019", "2024"));
        }

        [Fact]
        public void LinkedKey_RequiresBothStoredValues()
        {
            Assert.Null(SilaInvoiceAttachment.LinkedKey("5105604019", null));
            Assert.Null(SilaInvoiceAttachment.LinkedKey(null, "2024"));
            Assert.Null(SilaInvoiceAttachment.LinkedKey("TESTINVOICE121", null));
        }

        [Fact]
        public void ReadFiscalYear_ReadsTheStoredPostingResponse()
        {
            string body = """{"d":{"SupplierInvoice":"5105604019","FiscalYear":"2024"}}""";

            Assert.Equal("5105604019", SilaInvoicePosting.ReadSupplierInvoice(body));
            Assert.Equal("2024", SilaInvoicePosting.ReadFiscalYear(body));
            Assert.Equal("51056040192024", SilaInvoiceAttachment.LinkedKey(SilaInvoicePosting.ReadSupplierInvoice(body), SilaInvoicePosting.ReadFiscalYear(body)));
        }

        [Fact]
        public void DocumentUrl_RejectsLocalhostAndUsesThePublicInvoiceFile()
        {
            Guid invoiceId = Guid.Parse("11111111-1111-1111-1111-111111111111");

            Assert.False(SilaInvoiceAttachment.Suitable("https://localhost:6001/api/v1/buyer/sila/invoices/" + invoiceId + "/file"));
            Assert.False(SilaInvoiceAttachment.Suitable("file:///srv/vosox/buyer/invoice.pdf"));
            Assert.Null(SilaInvoiceAttachment.DocumentUrl("LOCAL", null, null, null, null, "https://localhost:6001", invoiceId, "invoice.pdf"));

            string? url = SilaInvoiceAttachment.DocumentUrl(
                "LOCAL", null, null, null, null, "https://sila-api.chervicaon.com", invoiceId, "invoice.pdf");

            Assert.Equal("https://sila-api.chervicaon.com/api/v1/buyer/sila/invoices/" + invoiceId.ToString("D") + "/file", url);
        }

        [Fact]
        public void DocumentUrl_UsesSharePointWhenThatStorageIsConfigured()
        {
            string? url = SilaInvoiceAttachment.DocumentUrl(
                "SHAREPOINT",
                "https://tenant.sharepoint.com/sites/finance",
                "Invoices",
                "2026",
                null,
                "https://sila-api.chervicaon.com",
                Guid.NewGuid(),
                "INV-1.pdf");

            Assert.Equal("https://tenant.sharepoint.com/sites/finance/Invoices/2026/INV-1.pdf", url);
        }

        [Fact]
        public void FunctionImportPath_PutsParametersOnTheUrlNotInAJsonBody()
        {
            string path = SilaInvoiceAttachment.FunctionImportPath(
                "/sap/opu/odata/sap/API_CV_ATTACHMENT_SRV/CreateUrlAsAttachment",
                "51056011442026",
                "https://sila-api.chervicaon.com/api/v1/buyer/sila/invoices/7917682c-4e4b-4492-af2f-db37b968a447/file",
                "TESTINVOICE123_PO4500004152_AED.pdf");

            Assert.StartsWith("/sap/opu/odata/sap/API_CV_ATTACHMENT_SRV/CreateUrlAsAttachment?", path, StringComparison.Ordinal);
            Assert.Contains("LinkedSAPObjectKey='51056011442026'", path, StringComparison.Ordinal);
            Assert.Contains("BusinessObjectTypeName='BUS2081'", path, StringComparison.Ordinal);
            Assert.Contains("Url='https://sila-api.chervicaon.com/api/v1/buyer/sila/invoices/7917682c-4e4b-4492-af2f-db37b968a447/file'", path, StringComparison.Ordinal);
            Assert.Contains("UrlDescription='TESTINVOICE123_PO4500004152_AED.pdf'", path, StringComparison.Ordinal);
            Assert.Contains("MIMEType='text/url'", path, StringComparison.Ordinal);
            Assert.Contains("SemanticObject=''", path, StringComparison.Ordinal);
            Assert.DoesNotContain("FileName=", path, StringComparison.Ordinal);
            Assert.DoesNotContain("{", path, StringComparison.Ordinal);
            Assert.Contains("LinkedSAPObjectKey", SilaInvoiceAttachment.FunctionImportParameters);
            Assert.DoesNotContain("FileName", SilaInvoiceAttachment.FunctionImportParameters);
        }

        [Fact]
        public void FunctionImportPath_EscapesODataStringQuotes()
        {
            string path = SilaInvoiceAttachment.FunctionImportPath(
                SilaInvoiceLifecycle.ATTACHMENT_PATH,
                "51056040192024",
                "https://files.example.com/a'b.pdf",
                "say 'hi'");

            Assert.Contains("Url='https://files.example.com/a''b.pdf'", path, StringComparison.Ordinal);
            Assert.Contains("UrlDescription='say ''hi'''", path, StringComparison.Ordinal);
        }

        [Fact]
        public void RequestBody_LegacyTemplateStillFillsTokensForDiagnostics()
        {
            string body = SilaInvoiceAttachment.RequestBody(null, "51056040192024", "https://sila-api.chervicaon.com/api/v1/buyer/sila/invoices/1/file", "INV-1.pdf");

            Assert.Contains("\"BusinessObjectTypeName\": \"BUS2081\"", body, StringComparison.Ordinal);
            Assert.Contains("\"LinkedSAPObjectKey\": \"51056040192024\"", body, StringComparison.Ordinal);
            Assert.Contains("\"Url\": \"https://sila-api.chervicaon.com/api/v1/buyer/sila/invoices/1/file\"", body, StringComparison.Ordinal);
            Assert.Contains("\"FileName\": \"INV-1.pdf\"", body, StringComparison.Ordinal);
        }

        [Fact]
        public void Timeline_AttachmentFailureLeavesInvoicePostingSuccessful()
        {
            var steps = SilaInvoiceLifecycle.Timeline(
                Common.SILA_INVOICE_AWAITING_PAYMENT, true, true, true, true, true, Common.SILA_POSTING_POSTED, Common.SILA_POSTING_FAILED);

            Assert.Equal("SUCCESS", steps.Single(x => x.Step == "S/4 INVOICE POSTING").Status);
            Assert.Equal("SUCCESS", steps.Single(x => x.Step == "LOCAL FINALIZATION").Status);
            Assert.Equal("FAILED", steps.Single(x => x.Step == "S/4 INVOICE ATTACHMENT").Status);
            Assert.Equal("PENDING", steps.Single(x => x.Step == "PAYMENT").Status);
        }

        [Fact]
        public void Timeline_UnknownAttachmentDoesNotResendTheInvoice()
        {
            var steps = SilaInvoiceLifecycle.Timeline(
                Common.SILA_INVOICE_AWAITING_PAYMENT, true, true, true, true, true, Common.SILA_POSTING_POSTED, Common.SILA_POSTING_UNKNOWN);

            Assert.Equal("SUCCESS", steps.Single(x => x.Step == "S/4 INVOICE POSTING").Status);
            Assert.Equal("UNKNOWN", steps.Single(x => x.Step == "S/4 INVOICE ATTACHMENT").Status);
        }

        [Fact]
        public void Describe_FailedAttachmentCanBeReprocessedWithoutChangingThePostedInvoice()
        {
            InventoryErpPosting invoicePosting = new InventoryErpPosting
            {
                Status = Common.SILA_POSTING_POSTED,
                ErpReference = "5105601144",
                ErpResponsePayload = """{"FiscalYear":"2026"}"""
            };
            InventoryErpPosting attachment = new InventoryErpPosting
            {
                Status = Common.SILA_POSTING_FAILED,
                ErrorMessage = "Invalid Function Import Parameter 'LinkedSAPObjectKey'",
                DateUpdated = new DateTime(2026, 10, 18, 23, 0, 0, DateTimeKind.Utc)
            };
            Invoice invoice = new Invoice { FileName = "TESTINVOICE123_PO4500004152_AED.pdf", InvoiceNumber = "TESTINVOICE121", Status = Common.SILA_INVOICE_AWAITING_PAYMENT };

            var screen = SilaInvoiceAttachment.Describe(invoicePosting, attachment, invoice);

            Assert.Equal("Supplier Invoice", screen.BusinessObject);
            Assert.Equal("BUS2081", screen.BusinessObjectType);
            Assert.Equal("51056011442026", screen.LinkedSapObjectKey);
            Assert.Equal("TESTINVOICE123_PO4500004152_AED.pdf", screen.FileName);
            Assert.Equal("Failed", screen.Status);
            Assert.True(screen.CanReprocess);
            Assert.Equal(Common.SILA_INVOICE_AWAITING_PAYMENT, invoice.Status);
            Assert.Equal(Common.SILA_POSTING_POSTED, invoicePosting.Status);
        }

        [Fact]
        public void Describe_UnknownAttachmentIsNotSentAgain()
        {
            InventoryErpPosting invoicePosting = new InventoryErpPosting
            {
                Status = Common.SILA_POSTING_POSTED,
                ErpReference = "5105604019",
                ErpResponsePayload = """{"FiscalYear":"2024"}"""
            };
            InventoryErpPosting attachment = new InventoryErpPosting { Status = Common.SILA_POSTING_UNKNOWN, ErpReference = null };

            var screen = SilaInvoiceAttachment.Describe(invoicePosting, attachment, new Invoice { FileName = "a.pdf", Status = Common.SILA_INVOICE_AWAITING_PAYMENT });

            Assert.Equal("Unknown", screen.Status);
            Assert.False(screen.CanReprocess);
            Assert.True(SilaInvoiceAttachment.BlocksResend(attachment));
        }

        [Fact]
        public void Describe_LocalFailureStaysOnTheAttachment()
        {
            InventoryErpPosting invoicePosting = new InventoryErpPosting
            {
                Status = Common.SILA_POSTING_POSTED,
                ErpReference = "5105604019",
                ErpResponsePayload = """{"FiscalYear":"2024"}"""
            };
            InventoryErpPosting attachment = new InventoryErpPosting
            {
                Status = Common.SILA_POSTING_FAILED_LOCAL,
                ErpReference = "51056040192024"
            };

            var screen = SilaInvoiceAttachment.Describe(invoicePosting, attachment, new Invoice { FileName = "a.pdf", Status = Common.SILA_INVOICE_AWAITING_PAYMENT });

            Assert.Equal("Failed", screen.Status);
            Assert.True(screen.CanReprocess);
            Assert.True(SilaTrackerRules.ErpAlreadyAccepted(attachment));
            Assert.Equal(Common.SILA_POSTING_POSTED, invoicePosting.Status);
        }
    }
}

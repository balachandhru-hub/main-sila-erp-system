using System.Text;
using System.Text.Json;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using SharedKernel.Integration.Entities;

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
            Assert.True(SilaInvoiceLifecycle.CanSubmit(Common.SILA_INVOICE_REVIEWED, false, true, false, false));
            Assert.False(SilaInvoiceLifecycle.CanSubmit(Common.SILA_INVOICE_REVIEWED, false, false, false, false));
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
        public void PurchaseOrderRead_KeepsTheInvoiceFields()
        {
            string payload = """
                {
                  "PurchaseOrder": "4500004152",
                  "CompanyCode": "1050",
                  "Supplier": "1003430",
                  "DocumentCurrency": "AED",
                  "to_PurchaseOrderItem": {
                    "results": [
                      {
                        "PurchaseOrderItem": "00010",
                        "Material": "1000000",
                        "OrderQuantity": "10",
                        "PurchaseOrderQuantityUnit": "EA",
                        "NetPriceAmount": "4570",
                        "Plant": "1050",
                        "TaxCode": "V1"
                      },
                      {
                        "PurchaseOrderItem": "00020",
                        "Material": "1000001",
                        "OrderQuantity": "5",
                        "PurchaseOrderQuantityUnit": "EA",
                        "NetPriceAmount": "300",
                        "Plant": "1050",
                        "TaxCode": "V1"
                      }
                    ]
                  }
                }
                """;
            using JsonDocument json = JsonDocument.Parse(payload);
            List<ApiFieldMapping> mappings = new List<ApiFieldMapping>
            {
                new ApiFieldMapping { TargetField = "Po.CompanyCode", SourceField = "CompanyCode" },
                new ApiFieldMapping { TargetField = "Po.Currency", SourceField = "DocumentCurrency" },
                new ApiFieldMapping { TargetField = "Po.SupplierCode", SourceField = "Supplier" },
                new ApiFieldMapping { TargetField = "Po.Number", SourceField = "PurchaseOrder" },
                new ApiFieldMapping { TargetField = "Po.Items", SourceField = "to_PurchaseOrderItem/results" },
                new ApiFieldMapping { TargetField = "Po.Items.LineNumber", SourceField = "PurchaseOrderItem" },
                new ApiFieldMapping { TargetField = "Po.Items.MaterialCode", SourceField = "Material" },
                new ApiFieldMapping { TargetField = "Po.Items.Quantity", SourceField = "OrderQuantity" },
                new ApiFieldMapping { TargetField = "Po.Items.Uom", SourceField = "PurchaseOrderQuantityUnit" },
                new ApiFieldMapping { TargetField = "Po.Items.UnitPrice", SourceField = "NetPriceAmount" }
            };

            SilaPurchaseOrderInvoiceRead.Order order = SilaPurchaseOrderInvoiceRead.FromRecord(mappings, json.RootElement);

            Assert.Equal("1050", order.CompanyCode);
            Assert.Equal("1003430", order.SupplierCode);
            Assert.Equal("AED", order.Currency);
            Assert.Equal("1050", order.Plant);
            Assert.Equal("V1", order.Lines[0].TaxCode);
            Assert.Equal("EA", order.Lines[1].Uom);
            Assert.Null(SilaPurchaseOrderInvoiceRead.MissingMessage(order, new[] { 10, 20 }));
            SilaPurchaseOrderInvoiceRead.Order incomplete = new SilaPurchaseOrderInvoiceRead.Order
            {
                CompanyCode = "1050",
                SupplierCode = "1003430",
                Currency = "AED"
            };
            incomplete.Lines.Add(new SilaPurchaseOrderInvoiceRead.Line { Item = "00010" });
            Assert.Contains("Unit of measure", SilaPurchaseOrderInvoiceRead.MissingMessage(incomplete, new[] { 10 }));
            string url = SilaPurchaseOrderInvoiceRead.WithItemExpand("https://example.test/A_PurchaseOrder?$top=100");
            Assert.Contains("$expand=to_PurchaseOrderItem", url, StringComparison.Ordinal);
            Assert.Equal("PurchaseOrder eq '4500004152'", SilaPurchaseOrderInvoiceRead.Filter("4500004152"));
        }

        [Fact]
        public void StoredPostingData_BuildsTheBodyFromTheInvoiceNotThePurchaseOrderQuantity()
        {
            Guid poItemId = Guid.NewGuid();
            Invoice invoice = new Invoice
            {
                InvoiceNumber = "TESTINVOICE123",
                InvoiceDate = new DateTime(2026, 10, 12),
                Currency = "AED",
                GrossAmount = 80,
                PoNumber = "4500004152"
            };
            InvoiceItem line = new InvoiceItem
            {
                Id = Guid.NewGuid(),
                LineNumber = 1,
                Description = "Item",
                Quantity = 80,
                Amount = 80,
                PurchaseOrderItemId = poItemId
            };
            PurchaseOrderItem poItem = new PurchaseOrderItem { Id = poItemId, LineNumber = 10 };
            SilaPurchaseOrderInvoiceRead.Order order = new SilaPurchaseOrderInvoiceRead.Order
            {
                CompanyCode = "1050",
                SupplierCode = "1003430",
                Currency = "AED",
                Plant = "1050"
            };
            order.Lines.Add(new SilaPurchaseOrderInvoiceRead.Line
            {
                Item = "00010",
                Material = "MAT-1",
                Uom = "EA",
                TaxCode = "V1",
                Plant = "1050",
                Quantity = "100"
            });

            SilaInvoicePostingData.Prepared prepared = SilaInvoicePostingData.Compose(
                invoice, new[] { line }, new[] { poItem }, new List<GoodsReceipt>(), new List<GoodsReceiptItem>(), new List<InventoryErpPosting>(), order, Guid.Empty, 1);
            SilaInvoicePostingData.Prepared? stored = SilaInvoicePostingData.Read(SilaInvoicePostingData.Write(prepared));

            Assert.Equal(SilaInvoicePostingData.READY, stored!.PreparationStatus);
            Assert.Empty(SilaInvoicePostingData.Missing(stored));
            Assert.Equal("80", stored.Lines[0].Fields.Single(x => x.ApiField == "QuantityInPurchaseOrderUnit").Value);
            Assert.Equal(SilaInvoicePostingData.SOURCE_PO_ITEM, stored.Lines[0].Fields.Single(x => x.ApiField == "TaxCode").Source);
            Assert.Equal(SilaInvoicePostingData.SOURCE_INVOICE, stored.Header.Single(x => x.ApiField == "SupplierInvoiceIDByInvcgParty").Source);

            string template = """
                {
                  "CompanyCode": "3000",
                  "DocumentDate": "2025-10-21T00:00",
                  "PostingDate": "2025-10-21T00:00",
                  "InvoicingParty": "1000569",
                  "DocumentCurrency": "AED",
                  "InvoiceGrossAmount": "301.30",
                  "AccountingDocumentType": "KR",
                  "TaxIsCalculatedAutomatically": false,
                  "SupplierInvoiceIDByInvcgParty": "002",
                  "to_SuplrInvcItemPurOrdRef": { "results": [ { "PurchaseOrder": "4500001161", "QuantityInPurchaseOrderUnit": "1" } ] },
                  "to_SupplierInvoiceItemGLAcct": { "results": [ { "GLAccount": "6270000011" } ] }
                }
                """;
            (string? body, List<string> missing) = SilaInvoicePosting.SupplierInvoiceRequest(template, SilaInvoicePostingData.ToDocument(stored));

            Assert.Empty(missing);
            Assert.NotNull(body);
            Assert.Contains("\"QuantityInPurchaseOrderUnit\":\"80\"", body, StringComparison.Ordinal);
            Assert.Contains("\"SupplierInvoiceItemAmount\":\"80.00\"", body, StringComparison.Ordinal);
            Assert.Contains("\"TaxCode\":\"V1\"", body, StringComparison.Ordinal);
            Assert.Contains("\"SupplierInvoiceIDByInvcgParty\":\"TESTINVOICE123\"", body, StringComparison.Ordinal);
            Assert.Contains("\"AccountingDocumentType\":\"RE\"", body, StringComparison.Ordinal);
            Assert.Contains("\"TaxIsCalculatedAutomatically\":true", body, StringComparison.Ordinal);
            Assert.DoesNotContain("\"QuantityInPurchaseOrderUnit\":\"100\"", body, StringComparison.Ordinal);
            Assert.DoesNotContain("6270000011", body, StringComparison.Ordinal);

            invoice.GrossAmount = 90;
            invoice.PostingData = SilaInvoicePostingData.Write(stored);
            string? blocked = SilaInvoicePostingData.BlockSend(stored, invoice, new[] { line });
            Assert.Contains("Refresh from S/4", blocked, StringComparison.Ordinal);
            Assert.Contains("not read again during reprocess", blocked, StringComparison.Ordinal);
        }

        [Fact]
        public void StoredPostingData_BlocksWhenTheTaxCodeIsMissing()
        {
            Guid poItemId = Guid.NewGuid();
            Invoice invoice = new Invoice
            {
                InvoiceNumber = "INV-9",
                InvoiceDate = new DateTime(2026, 10, 1),
                Currency = "AED",
                GrossAmount = 10,
                PoNumber = "4500001"
            };
            InvoiceItem line = new InvoiceItem { LineNumber = 1, Description = "Item", Quantity = 1, Amount = 10, PurchaseOrderItemId = poItemId };
            SilaPurchaseOrderInvoiceRead.Order order = new SilaPurchaseOrderInvoiceRead.Order
            {
                CompanyCode = "1050",
                SupplierCode = "1003430",
                Currency = "AED"
            };
            order.Lines.Add(new SilaPurchaseOrderInvoiceRead.Line { Item = "00010", Uom = "EA", Material = "MAT-1" });

            SilaInvoicePostingData.Prepared prepared = SilaInvoicePostingData.Compose(
                invoice, new[] { line }, new[] { new PurchaseOrderItem { Id = poItemId, LineNumber = 10 } },
                new List<GoodsReceipt>(), new List<GoodsReceiptItem>(), new List<InventoryErpPosting>(), order, Guid.Empty, 1);

            Assert.Equal(SilaInvoicePostingData.INVALID, prepared.PreparationStatus);
            Assert.Contains(SilaInvoicePostingData.Missing(prepared), x => x.Contains("Tax code", StringComparison.Ordinal) && x.Contains("S/4 purchase order item", StringComparison.Ordinal));
        }

        [Fact]
        public void PurchaseOrderRead_FollowsTheNextPage()
        {
            Assert.Equal("https://example.test/next", SilaErpPull.NextLink("""{"@odata.nextLink":"https://example.test/next","value":[]}"""));
            using JsonDocument first = JsonDocument.Parse("""
                {
                  "PurchaseOrder": "4500004152",
                  "to_PurchaseOrderItem": { "results": [ { "PurchaseOrderItem": "00010" } ], "@odata.nextLink": "https://example.test/items" }
                }
                """);
            JsonElement merged = SilaErpPull.ReplaceItems(first.RootElement, new[]
            {
                JsonDocument.Parse("""{"PurchaseOrderItem":"00010"}""").RootElement,
                JsonDocument.Parse("""{"PurchaseOrderItem":"00020"}""").RootElement
            });

            Assert.Contains("00020", merged.GetRawText(), StringComparison.Ordinal);
            Assert.DoesNotContain("example.test/items", merged.GetRawText(), StringComparison.Ordinal);
        }

        [Fact]
        public void GrnPdf_IsAPdfDocument()
        {
            byte[] pdf = SilaGrnDocument.Pdf(new List<string> { "GRN GRN000001", "PO 4500001" });

            Assert.StartsWith("%PDF", Encoding.ASCII.GetString(pdf));
        }

        [Fact]
        public void GoodsReceiptSelection_PicksTheExactQuantitiesEvenWhenAnotherInvoiceDidNotPost()
        {
            Guid itemA = Guid.NewGuid();
            Guid itemB = Guid.NewGuid();
            Guid exact = Guid.NewGuid();
            Guid other = Guid.NewGuid();
            List<SilaGoodsReceiptSelection.Line> invoice = new()
            {
                new() { PurchaseOrderItemId = itemA, Quantity = 4 },
                new() { PurchaseOrderItemId = itemB, Quantity = 6 }
            };
            SilaGoodsReceiptSelection.Choice choice = SilaGoodsReceiptSelection.Select(invoice, new[]
            {
                new SilaGoodsReceiptSelection.Receipt
                {
                    Id = other,
                    GrnNumber = "GR000001",
                    Available = true,
                    Lines = new() { new() { PurchaseOrderItemId = itemA, Quantity = 1 } }
                },
                new SilaGoodsReceiptSelection.Receipt
                {
                    Id = exact,
                    GrnNumber = "GR000002",
                    Available = !SilaGoodsReceiptSelection.Holds(Common.SILA_INVOICE_POSTING_FAILED, null),
                    Lines = new()
                    {
                        new() { PurchaseOrderItemId = itemA, Quantity = 4 },
                        new() { PurchaseOrderItemId = itemB, Quantity = 6 }
                    }
                }
            });

            Assert.False(SilaGoodsReceiptSelection.Holds(Common.SILA_INVOICE_POSTING_FAILED, null));
            Assert.True(SilaGoodsReceiptSelection.Holds(Common.SILA_INVOICE_POSTED, null));
            Assert.Equal(new[] { exact }, choice.Ids);
            Assert.Contains("GR000002", choice.Reason, StringComparison.Ordinal);
        }

        [Fact]
        public void GoodsReceiptSelection_CombinesReceiptsWhenOneDoesNotCoverTheInvoice()
        {
            Guid first = Guid.NewGuid();
            Guid second = Guid.NewGuid();
            List<SilaGoodsReceiptSelection.Line> invoice = new()
            {
                new() { Quantity = 2 },
                new() { Quantity = 5 }
            };
            SilaGoodsReceiptSelection.Choice choice = SilaGoodsReceiptSelection.Select(invoice, new[]
            {
                new SilaGoodsReceiptSelection.Receipt
                {
                    Id = first,
                    GrnNumber = "GR000001",
                    Available = true,
                    Lines = new() { new() { Quantity = 2 } }
                },
                new SilaGoodsReceiptSelection.Receipt
                {
                    Id = second,
                    GrnNumber = "GR000002",
                    Available = true,
                    Lines = new() { new() { Quantity = 5 } }
                }
            });

            Assert.Equal(2, choice.Ids.Count);
            Assert.Contains(first, choice.Ids);
            Assert.Contains(second, choice.Ids);
        }

        [Fact]
        public void GoodsReceiptSelection_LeavesAPostedInvoiceReceiptAlone()
        {
            Guid posted = Guid.NewGuid();
            SilaGoodsReceiptSelection.Choice choice = SilaGoodsReceiptSelection.Select(
                new[] { new SilaGoodsReceiptSelection.Line { Quantity = 3 } },
                new[]
                {
                    new SilaGoodsReceiptSelection.Receipt
                    {
                        Id = posted,
                        GrnNumber = "GR000009",
                        Available = !SilaGoodsReceiptSelection.Holds(Common.SILA_INVOICE_POSTED, Common.SILA_POSTING_POSTED),
                        Lines = new() { new() { Quantity = 3 } }
                    }
                });

            Assert.Empty(choice.Ids);
        }

        [Fact]
        public void ErpCode_KeepsTheSupplierNumber()
        {
            Assert.Equal("1003430", SilaReceivingRules.ErpCode("1003430"));
            Assert.Null(SilaReceivingRules.ErpCode("86156347-8517-4DAA-8356-33314EF0FDF3"));
        }

        [Fact]
        public void Compose_UsesPurchaseOrderTaxAndTheErpGoodsReceipt()
        {
            Guid poItemId = Guid.NewGuid();
            Guid receiptId = Guid.NewGuid();
            Guid postingId = Guid.NewGuid();
            SilaPurchaseOrderInvoiceRead.Order sap = new SilaPurchaseOrderInvoiceRead.Order
            {
                CompanyCode = "1050",
                Currency = "AED"
            };
            SilaInvoicePostingData.Prepared prepared = SilaInvoicePostingData.Compose(
                new Invoice
                {
                    InvoiceNumber = "INV-1",
                    InvoiceDate = new DateTime(2026, 10, 1),
                    Currency = "AED",
                    GrossAmount = 10,
                    PoNumber = "4500004152"
                },
                new[]
                {
                    new InvoiceItem
                    {
                        Id = Guid.NewGuid(),
                        LineNumber = 1,
                        Description = "Line",
                        Quantity = 10,
                        Amount = 10,
                        PurchaseOrderItemId = poItemId
                    }
                },
                new[]
                {
                    new PurchaseOrderItem
                    {
                        Id = poItemId,
                        LineNumber = 10,
                        ProductName = "Item",
                        Quantity = 10,
                        TaxCode = "V1"
                    }
                },
                new[]
                {
                    new GoodsReceipt
                    {
                        Id = receiptId,
                        GrnNumber = "GR000002",
                        ErpPostingId = postingId,
                        PurchaseOrderId = Guid.NewGuid(),
                        PoNumber = "4500004152",
                        Status = Common.SILA_GRN_POSTED
                    }
                },
                new[] { new GoodsReceiptItem { GoodsReceiptId = receiptId, PurchaseOrderItemId = poItemId } },
                new[] { new InventoryErpPosting { Id = postingId, ErpReference = "5000003137", Status = Common.SILA_POSTING_POSTED } },
                sap,
                Guid.NewGuid(),
                1,
                erpSupplierCode: "1003430");

            Assert.Equal("1003430", prepared.Header.Single(x => x.ApiField == "InvoicingParty").Value);
            Assert.Equal("V1", prepared.Lines[0].Fields.Single(x => x.ApiField == "TaxCode").Value);
            Assert.Equal("5000003137", prepared.Lines[0].Fields.Single(x => x.ApiField == "GrnNumber").Value);
        }
    }
}

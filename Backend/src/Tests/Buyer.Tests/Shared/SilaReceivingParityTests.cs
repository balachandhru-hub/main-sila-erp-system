using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;

namespace Buyer.Tests.Shared
{
    /// <summary>Receiving rules added for the prototype parity: PO line status, batch / expiry, service invoices, reconciliation.</summary>
    public class SilaReceivingParityTests
    {
        private static readonly DateTime Today = new DateTime(2026, 10, 5);

        [Theory]
        [InlineData(10, 0, "OPEN")]
        [InlineData(10, 4, Common.SILA_PO_PARTIALLY_RECEIVED)]
        [InlineData(10, 10, Common.SILA_PO_RECEIVED)]
        public void LineStatus_FollowsReceivedQuantity(decimal ordered, decimal received, string expected)
        {
            PurchaseOrderItem item = new PurchaseOrderItem { Quantity = ordered, ReceivedQuantity = received };
            Assert.Equal(expected, SilaReceivingRules.LineStatus(item));
        }

        [Fact]
        public void GoodsReceiptExpected_FalseForServiceMaterialOrSourceFlag()
        {
            PurchaseOrderItem item = new PurchaseOrderItem { LineNumber = 10 };
            Assert.True(SilaReceivingRules.GoodsReceiptExpected(item, null));
            Assert.False(SilaReceivingRules.GoodsReceiptExpected(item, new ItemBuyerMaster { InventoryType = "SERVICE" }));
            Assert.False(SilaReceivingRules.GoodsReceiptExpected(new PurchaseOrderItem { GoodsReceiptExpected = false }, null));
            Assert.Equal("00010", SilaReceivingRules.ItemNumber(item));
        }

        [Fact]
        public void BatchExpiry_RequiredOnlyForManagedMaterialsWithAcceptedQuantity()
        {
            PurchaseOrderItem item = new PurchaseOrderItem { LineNumber = 1, ProductName = "Milk" };
            ItemBuyerMaster material = new ItemBuyerMaster { BatchManaged = true, ExpiryManaged = true };
            SilaReceivingGrnLineWriteDto line = new SilaReceivingGrnLineWriteDto { ReceivedQty = 5, AcceptedQty = 5 };

            Assert.Contains("batch", SilaReceivingRules.BatchExpiryProblem(line, item, material, Today));
            line.BatchNumber = "B-1";
            Assert.Contains("expiry", SilaReceivingRules.BatchExpiryProblem(line, item, material, Today));
            line.ExpiryDate = Today.AddDays(-1);
            Assert.Contains("passed", SilaReceivingRules.BatchExpiryProblem(line, item, material, Today));
            line.ExpiryDate = Today.AddDays(10);
            Assert.Null(SilaReceivingRules.BatchExpiryProblem(line, item, material, Today));

            SilaReceivingGrnLineWriteDto rejected = new SilaReceivingGrnLineWriteDto { ReceivedQty = 5, RejectedQty = 5 };
            Assert.Null(SilaReceivingRules.BatchExpiryProblem(rejected, item, material, Today));
        }

        [Fact]
        public void ServiceInvoice_HasNoGoodsReceipt()
        {
            Assert.True(SilaReceivingRules.IsServiceInvoice(new Invoice { InvoiceType = "SERVICE" }));
            Assert.False(SilaReceivingRules.IsServiceInvoice(new Invoice { InvoiceType = "MIXED" }));
            Assert.False(SilaReceivingRules.IsServiceInvoice(null));
            Assert.Equal("SERVICE", SilaInvoiceApply.InvoiceType(" service "));
            Assert.Null(SilaInvoiceApply.InvoiceType("UNKNOWN"));
        }

        [Fact]
        public void Reconciliation_WarnsOutsideTheTolerance()
        {
            Assert.Null(SilaOcrPolicy.ReconciliationWarning(100m, 5m, 105.04m, 0.05m));
            Assert.NotNull(SilaOcrPolicy.ReconciliationWarning(100m, 5m, 106m, 0.05m));
            Assert.Null(SilaOcrPolicy.ReconciliationWarning(null, 5m, 106m, 0.05m));
        }

        [Fact]
        public void OcrPolicy_DefaultsAndPartialChange()
        {
            SilaOcrConfiguration settings = new SilaOcrConfiguration();
            Assert.Equal(60, SilaOcrPolicy.TimeoutSeconds(settings));
            Assert.True(SilaOcrPolicy.DetailedLineExtraction(settings));
            Assert.False(SilaOcrPolicy.ReuseCachedOcr(settings));

            SilaOcrPolicy.Apply(new Buyer.Tests.Support.FakeLogger(), settings, new SilaOcrConfigurationWriteDto { BackendTimeoutSeconds = 30, ReuseCachedOcr = true });
            Assert.Equal(30, SilaOcrPolicy.TimeoutSeconds(settings));
            Assert.True(SilaOcrPolicy.ReuseCachedOcr(settings));
            Assert.Equal(SilaOcrPolicy.DEFAULT_RETRY_COUNT, SilaOcrPolicy.RetryCount(settings));
        }
    }
}

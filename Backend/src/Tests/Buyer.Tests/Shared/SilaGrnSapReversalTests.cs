using System.Text.Json;
using Buyer.Application.Features.Shared;
using Xunit;

namespace Buyer.Tests.Shared
{
    public class SilaGrnSapReversalTests
    {
        [Fact]
        public void ReversalBody_Uses102_AndPositivePartialQuantity()
        {
            string body = SilaGrnSap.ReversalBody(
                new DateTime(2026, 10, 19),
                new DateTime(2026, 10, 19),
                isFullRemainingReversal: false,
                referenceDocument: null,
                lines: new[]
                {
                    new SilaGrnReversalSapLine
                    {
                        Material = "1000000",
                        Plant = "1020",
                        StorageLocation = "0001",
                        Quantity = 4,
                        EntryUnit = "EA",
                        PurchaseOrder = "4500004152",
                        PurchaseOrderItem = "00010"
                    },
                    new SilaGrnReversalSapLine
                    {
                        Material = "2000000",
                        Plant = "1020",
                        StorageLocation = "0001",
                        Quantity = 2,
                        EntryUnit = "BTL",
                        PurchaseOrder = "4500004152",
                        PurchaseOrderItem = "00020"
                    }
                });

            using JsonDocument json = JsonDocument.Parse(body);
            JsonElement root = json.RootElement;
            Assert.Equal("2026-10-19T00:00:00", root.GetProperty("PostingDate").GetString());
            Assert.Equal("2026-10-19T00:00:00", root.GetProperty("DocumentDate").GetString());
            Assert.Equal("01", root.GetProperty("GoodsMovementCode").GetString());
            Assert.Equal("GRN Partial Reversal", root.GetProperty("MaterialDocumentHeaderText").GetString());
            Assert.False(root.TryGetProperty("DocumentHeaderText", out _));
            Assert.Equal("GRN-REVERSAL", root.GetProperty("ReferenceDocument").GetString());

            JsonElement items = root.GetProperty("to_MaterialDocumentItem");
            Assert.Equal(2, items.GetArrayLength());
            Assert.Equal("B", items[0].GetProperty("GoodsMovementRefDocType").GetString());
            Assert.Equal("102", items[0].GetProperty("GoodsMovementType").GetString());
            Assert.Equal("4", items[0].GetProperty("QuantityInEntryUnit").GetString());
            Assert.Equal("00010", items[0].GetProperty("PurchaseOrderItem").GetString());
            Assert.Equal("2", items[1].GetProperty("QuantityInEntryUnit").GetString());
            Assert.DoesNotContain("-", items[0].GetProperty("QuantityInEntryUnit").GetString());
            Assert.Equal("4", SilaGrnSap.FormatQuantity(4m));
            Assert.Equal("4.5", SilaGrnSap.FormatQuantity(4.5m));
        }

        [Fact]
        public void ReversalBody_FullRemaining_UsesGrnReversalHeaderText()
        {
            string body = SilaGrnSap.ReversalBody(
                new DateTime(2026, 10, 19),
                new DateTime(2026, 10, 19),
                isFullRemainingReversal: true,
                referenceDocument: null,
                lines: new[]
                {
                    new SilaGrnReversalSapLine
                    {
                        Material = "1000000",
                        Plant = "1020",
                        StorageLocation = "0001",
                        Quantity = 10,
                        EntryUnit = "EA",
                        PurchaseOrder = "4500004152",
                        PurchaseOrderItem = "00010"
                    }
                });

            using JsonDocument json = JsonDocument.Parse(body);
            Assert.Equal("GRN Reversal", json.RootElement.GetProperty("MaterialDocumentHeaderText").GetString());
            Assert.Equal("10", json.RootElement.GetProperty("to_MaterialDocumentItem")[0].GetProperty("QuantityInEntryUnit").GetString());
        }

        [Fact]
        public void IsReversalConfiguredName_RequiresExactFiveName()
        {
            Assert.True(SilaGrnSap.IsReversalConfiguredName("FIVE S4-GRN REVERSAL"));
            Assert.False(SilaGrnSap.IsReversalConfiguredName("FIVE S4-GRN POSTING"));
            Assert.False(SilaGrnSap.IsConfiguredName("FIVE S4-GRN REVERSAL"));
            Assert.True(SilaGrnSap.IsConfiguredName("FIVE S4-GRN POSTING"));
            Assert.True(SilaGrnSap.IsConfiguredName("FIVE S4 GRN POSTING"));
            Assert.True(SilaGrnSap.IsConfiguredName("FIVE S4 - POST GRN"));
        }

        [Fact]
        public void ValidateReversalBody_AcceptsAuthoritativeLines()
        {
            SilaGrnReversalSapLine[] lines =
            {
                new SilaGrnReversalSapLine
                {
                    Material = "MAT-A",
                    Plant = "1020",
                    StorageLocation = "0001",
                    Quantity = 4,
                    EntryUnit = "BTL",
                    PurchaseOrder = "4500999999",
                    PurchaseOrderItem = "00010"
                }
            };
            string body = SilaGrnSap.ReversalBody(new DateTime(2026, 10, 19), new DateTime(2026, 10, 19), false, null, lines);
            Assert.Null(SilaGrnSap.ValidateReversalBody(body, lines, false));
        }

        [Fact]
        public void ValidateReversalBody_StopsWhenMaterialWouldChange()
        {
            SilaGrnReversalSapLine[] lines =
            {
                new SilaGrnReversalSapLine
                {
                    Material = "MAT-A",
                    Plant = "1020",
                    StorageLocation = "0001",
                    Quantity = 4,
                    EntryUnit = "BTL",
                    PurchaseOrder = "4500999999",
                    PurchaseOrderItem = "00010"
                }
            };
            string body = SilaGrnSap.ReversalBody(new DateTime(2026, 10, 19), new DateTime(2026, 10, 19), false, null, lines)
                .Replace("MAT-A", "WRONG", StringComparison.Ordinal);
            string? error = SilaGrnSap.ValidateReversalBody(body, lines, false);
            Assert.NotNull(error);
            Assert.Contains(SilaGrnSap.REVERSAL_MISMATCH, error, StringComparison.Ordinal);
            Assert.Contains("Material", error, StringComparison.Ordinal);
            Assert.Contains("MAT-A", error, StringComparison.Ordinal);
            Assert.Contains("WRONG", error, StringComparison.Ordinal);
        }

        [Fact]
        public void ReadPostedGrnItems_UsesOriginal101PlantAndOmitsBlankSloc()
        {
            const string body = """
                {"DocumentDate":"/Date(1)/","PostingDate":"/Date(1)/","GoodsMovementCode":"01","MaterialDocumentHeaderText":"GR000003","to_MaterialDocumentItem":[{"Material":"1000000","Plant":"1050","GoodsMovementType":"101","PurchaseOrder":"4500004152","PurchaseOrderItem":"00010","GoodsMovementRefDocType":"B","EntryUnit":"EA","QuantityInEntryUnit":"10.0000"}]}
                """;
            List<SilaGrnPostedSapLine> posted = SilaGrnSap.ReadPostedGrnItems(body);
            Assert.Single(posted);
            Assert.Equal("1050", posted[0].Plant);
            Assert.Null(posted[0].StorageLocation);
            SilaGrnPostedSapLine? found = SilaGrnSap.FindPostedLine(posted, "1000000", "00010");
            Assert.NotNull(found);
            Assert.Equal("1050", found!.Plant);
        }
    }
}

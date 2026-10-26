using System.Text.Json;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;

namespace Buyer.Tests.Shared
{
    /// <summary>
    /// The one stock-posting decision: 311, 301, Z02 and Z01, with positive quantities and no invented units.
    /// </summary>
    public class SilaInventorySapTests
    {
        [Fact]
        public void DecideTransfer_Uses311ForTheSamePlantAnd301ForAnotherPlantInTheCompany()
        {
            string? same = SilaInventorySap.DecideTransfer("PL-A", "FROM", "PL-A", "TO", "1000", "1000", out SilaInventorySap.Rule? transfer);
            Assert.Null(same);
            Assert.Equal(SilaInventorySap.API_TRANSFER, transfer!.ApiName);
            Assert.Equal("04", transfer.GoodsMovementCode);
            Assert.Equal("311", transfer.GoodsMovementType);

            string? plant = SilaInventorySap.DecideTransfer("PL-A", "FROM", "PL-B", "FROM", "1000", "1000", out SilaInventorySap.Rule? other);
            Assert.Null(plant);
            Assert.Equal(SilaInventorySap.API_PLANT_TRANSFER, other!.ApiName);
            Assert.Equal("301", other.GoodsMovementType);
            Assert.True(other.ReceivingPlant);

            Assert.Equal(
                SilaInventorySap.CROSS_COMPANY_TRANSFER_NOT_CONFIGURED,
                SilaInventorySap.DecideTransfer("PL-A", "FROM", "PL-B", "TO", "1000", "2000", out _));
        }

        [Fact]
        public void Effect_AggregatesARecipeConsumptionAndKeepsTheFraction()
        {
            ItemBuyerMaster material = Stock("MAT-1", "BTL");
            List<SilaInventorySap.TransferLine> lines = new List<SilaInventorySap.TransferLine>
            {
                new SilaInventorySap.TransferLine(material, 0.100m, "BTL"),
                new SilaInventorySap.TransferLine(material, 0.150m, "BTL"),
                new SilaInventorySap.TransferLine(material, 0.150m, "BTL")
            };

            string? problem = SilaInventorySap.TryBuildEffect(
                new DateTime(2026, 10, 16),
                "PL-A",
                "BAR",
                SilaInventorySap.GoodsIssue,
                lines,
                new Dictionary<Guid, List<MaterialUomConversion>>(),
                out string? body);

            Assert.Null(problem);
            Assert.NotNull(body);
            using JsonDocument json = JsonDocument.Parse(body);
            JsonElement line = json.RootElement.GetProperty("to_MaterialDocumentItem")[0];
            Assert.Equal("03", json.RootElement.GetProperty("GoodsMovementCode").GetString());
            Assert.Equal(SilaInventorySap.API_GOODS_ISSUE, SilaInventorySap.GoodsIssue.ApiName);
            Assert.Equal("Z02", line.GetProperty("GoodsMovementType").GetString());
            Assert.Equal("0.400", line.GetProperty("QuantityInEntryUnit").GetString());
            Assert.Equal("BTL", line.GetProperty("EntryUnit").GetString());
            Assert.Equal("PL-A", line.GetProperty("Plant").GetString());
            Assert.Equal("BAR", line.GetProperty("StorageLocation").GetString());
            Assert.Equal(1, json.RootElement.GetProperty("to_MaterialDocumentItem").GetArrayLength());
        }

        [Fact]
        public void Effect_RoutesAPositiveCorrectionToZ01AndRefusesAMissingUnit()
        {
            Assert.Equal("Z02", SilaInventorySap.MovementForSale(null, 10m));
            Assert.Equal("Z01", SilaInventorySap.MovementForSale(null, -2m));
            Assert.Equal(SilaInventorySap.API_POSITIVE_ADJUSTMENT, SilaInventorySap.ForDirection(Common.SILA_DIRECTION_IN).ApiName);
            Assert.Equal(SilaInventorySap.API_GOODS_ISSUE, SilaInventorySap.ForDirection(Common.SILA_DIRECTION_OUT).ApiName);

            ItemBuyerMaster material = Stock("MAT-1", "BTL");
            material.BaseUnitOfMeasure = "";
            string? missing = SilaInventorySap.TryBuildEffect(
                DateTime.UtcNow,
                "PL-A",
                "BAR",
                SilaInventorySap.PositiveAdjustment,
                new[] { new SilaInventorySap.TransferLine(material, 2m, "BTL") },
                new Dictionary<Guid, List<MaterialUomConversion>>(),
                out string? body);
            Assert.Equal(SilaInventorySap.UOM_CONVERSION_MISSING, missing);
            Assert.Null(body);
            Assert.Throws<ArgumentOutOfRangeException>(() => SilaInventorySap.FormatQuantity(-5m));
        }

        [Fact]
        public void Effect_ConvertsWithTheMaterialFactorAndDoesNotInventOne()
        {
            ItemBuyerMaster material = Stock("MAT-1", "BTL");
            Dictionary<Guid, List<MaterialUomConversion>> missing = new Dictionary<Guid, List<MaterialUomConversion>>();
            Assert.Equal(SilaInventorySap.UOM_CONVERSION_MISSING, SilaInventorySap.TryBuildEffect(
                DateTime.UtcNow, "PL-A", "BAR", SilaInventorySap.GoodsIssue,
                new[] { new SilaInventorySap.TransferLine(material, 300m, "ML") }, missing, out _));

            Dictionary<Guid, List<MaterialUomConversion>> conversions = new Dictionary<Guid, List<MaterialUomConversion>>
            {
                [material.Id] = new List<MaterialUomConversion>
                {
                    new MaterialUomConversion { MaterialId = material.Id, FromUom = "ML", ToUom = "BTL", Factor = 1m / 750m, IsActive = true }
                }
            };
            string? problem = SilaInventorySap.TryBuildEffect(
                new DateTime(2026, 10, 16), "PL-A", "BAR", SilaInventorySap.GoodsIssue,
                new[] { new SilaInventorySap.TransferLine(material, 300m, "ML") }, conversions, out string? body);
            Assert.Null(problem);
            Assert.NotNull(body);
            using JsonDocument json = JsonDocument.Parse(body);
            Assert.Equal("0.400", json.RootElement.GetProperty("to_MaterialDocumentItem")[0].GetProperty("QuantityInEntryUnit").GetString());
            Assert.Equal("BTL", json.RootElement.GetProperty("to_MaterialDocumentItem")[0].GetProperty("EntryUnit").GetString());
        }

        private static ItemBuyerMaster Stock(string code, string unit)
        {
            return new ItemBuyerMaster
            {
                Id = Guid.NewGuid(),
                MaterialCode = code,
                BaseUnitOfMeasure = unit,
                IsInventoryItem = true,
                InventoryType = "STOCK",
                IsActive = true
            };
        }
    }
}

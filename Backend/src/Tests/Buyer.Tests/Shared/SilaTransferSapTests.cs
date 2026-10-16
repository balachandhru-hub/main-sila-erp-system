using System.Text.Json;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;

namespace Buyer.Tests.Shared
{
    /// <summary>
    /// Same-plant transfer request built for FIVE S4 - Transfer Stock. Plants and units come from the test data.
    /// </summary>
    public class SilaTransferSapTests
    {
        [Fact]
        public void LocationProblem_AllowsSamePlantAndDifferentStorageLocation()
        {
            Assert.Null(SilaTransferSap.LocationProblem("PL-9", "AA", "PL-9", "BB"));
            Assert.Null(SilaTransferSap.LocationProblem(" pl-9 ", "aa", "PL-9", "bb"));
        }

        [Fact]
        public void LocationProblem_RejectsMissingMappingPlantMismatchAndSameStorageLocation()
        {
            Assert.Equal(SilaTransferSap.SOURCE_SAP_LOCATION_MAPPING_MISSING, SilaTransferSap.LocationProblem(null, "AA", "PL-9", "BB"));
            Assert.Equal(SilaTransferSap.SOURCE_SAP_LOCATION_MAPPING_MISSING, SilaTransferSap.LocationProblem("PL-9", " ", "PL-9", "BB"));
            Assert.Equal(SilaTransferSap.DESTINATION_SAP_LOCATION_MAPPING_MISSING, SilaTransferSap.LocationProblem("PL-9", "AA", "PL-9", null));
            Assert.Equal(SilaTransferSap.DESTINATION_SAP_LOCATION_MAPPING_MISSING, SilaTransferSap.LocationProblem("PL-9", "AA", null, "BB"));
            Assert.Equal(SilaTransferSap.TRANSFER_PLANT_MISMATCH, SilaTransferSap.LocationProblem("PL-9", "AA", "PL-8", "BB"));
            Assert.Equal(SilaTransferSap.INVALID_TRANSFER_LOCATION, SilaTransferSap.LocationProblem("PL-9", "AA", "PL-9", "AA"));
        }

        [Fact]
        public void EntryUnit_UsesTheMaterialUnitAndDoesNotInventOne()
        {
            Assert.Null(SilaTransferSap.EntryUnitOf(null));
            Assert.Null(SilaTransferSap.EntryUnitOf("  "));
            Assert.Equal("KG", SilaTransferSap.EntryUnitOf(" KG "));
        }

        [Fact]
        public void FormatQuantity_IsPositiveAndKeepsFractions()
        {
            Assert.Equal("5.000", SilaTransferSap.FormatQuantity(5m));
            Assert.Equal("0.400", SilaTransferSap.FormatQuantity(0.400m));
            Assert.Equal("0.4001", SilaTransferSap.FormatQuantity(0.4001m));
            Assert.Throws<ArgumentOutOfRangeException>(() => SilaTransferSap.FormatQuantity(-5m));
            Assert.Throws<ArgumentOutOfRangeException>(() => SilaTransferSap.FormatQuantity(0m));
        }

        [Fact]
        public void TryBuildBody_PostsEveryLineOnceForTheSamePlant()
        {
            (InternalTransferOrder transfer, InventoryLocation from, InventoryLocation to, BuyerProperty source, BuyerProperty destination) document = Document();
            ItemBuyerMaster first = Stock("MAT-A", "KG");
            ItemBuyerMaster second = Stock("MAT-B", "BOX");
            ItemBuyerMaster skipped = Stock("MAT-C", "KG");
            List<InternalTransferOrderItem> items = new List<InternalTransferOrderItem>
            {
                Line(first, 0.400m, "KG"),
                Line(second, 2m, "BOX"),
                Line(skipped, 0m, "KG")
            };
            Dictionary<Guid, ItemBuyerMaster> materials = new Dictionary<Guid, ItemBuyerMaster>
            {
                [first.Id] = first,
                [second.Id] = second,
                [skipped.Id] = skipped
            };

            string? problem = SilaTransferSap.TryBuildBody(
                document.transfer, document.from, document.to, document.source, document.destination,
                items, materials, new Dictionary<Guid, List<MaterialUomConversion>>(), out string? body);

            Assert.Null(problem);
            Assert.NotNull(body);
            using JsonDocument json = JsonDocument.Parse(body);
            JsonElement root = json.RootElement;
            Assert.Equal("04", root.GetProperty("GoodsMovementCode").GetString());
            Assert.Equal("2026-10-16T00:00:00", root.GetProperty("PostingDate").GetString());
            Assert.Equal("2026-10-16T00:00:00", root.GetProperty("DocumentDate").GetString());
            JsonElement lines = root.GetProperty("to_MaterialDocumentItem");
            Assert.Equal(2, lines.GetArrayLength());
            Assert.Equal("MAT-A", lines[0].GetProperty("Material").GetString());
            Assert.Equal("PL-9", lines[0].GetProperty("Plant").GetString());
            Assert.Equal("AA", lines[0].GetProperty("StorageLocation").GetString());
            Assert.Equal("311", lines[0].GetProperty("GoodsMovementType").GetString());
            Assert.Equal("0.400", lines[0].GetProperty("QuantityInEntryUnit").GetString());
            Assert.Equal("KG", lines[0].GetProperty("EntryUnit").GetString());
            Assert.Equal("BB", lines[0].GetProperty("IssuingOrReceivingStorageLoc").GetString());
            Assert.Equal("MAT-B", lines[1].GetProperty("Material").GetString());
            Assert.Equal("2.000", lines[1].GetProperty("QuantityInEntryUnit").GetString());
            Assert.Equal("BOX", lines[1].GetProperty("EntryUnit").GetString());
            Assert.Equal(SilaTransferSap.API_CONFIG_NAME, "FIVE S4 - Transfer Stock");
            Assert.Equal("311", SilaTransferSap.GOODS_MOVEMENT_TYPE);
            Assert.DoesNotContain("-", lines[0].GetProperty("QuantityInEntryUnit").GetString());
        }

        [Fact]
        public void TryBuildBody_ConvertsWithTheMaterialFactorOnly()
        {
            (InternalTransferOrder transfer, InventoryLocation from, InventoryLocation to, BuyerProperty source, BuyerProperty destination) document = Document();
            ItemBuyerMaster material = Stock("MAT-A", "KG");
            InternalTransferOrderItem item = Line(material, 0.2m, "CASE");
            Dictionary<Guid, List<MaterialUomConversion>> missing = new Dictionary<Guid, List<MaterialUomConversion>>();
            string? missingProblem = SilaTransferSap.TryBuildBody(
                document.transfer, document.from, document.to, document.source, document.destination,
                new[] { item }, new Dictionary<Guid, ItemBuyerMaster> { [material.Id] = material }, missing, out string? missingBody);
            Assert.Equal(SilaTransferSap.UOM_CONVERSION_MISSING, missingProblem);
            Assert.Null(missingBody);

            Dictionary<Guid, List<MaterialUomConversion>> conversions = new Dictionary<Guid, List<MaterialUomConversion>>
            {
                [material.Id] = new List<MaterialUomConversion>
                {
                    new MaterialUomConversion { MaterialId = material.Id, FromUom = "CASE", ToUom = "KG", Factor = 2m, IsActive = true }
                }
            };
            string? problem = SilaTransferSap.TryBuildBody(
                document.transfer, document.from, document.to, document.source, document.destination,
                new[] { item }, new Dictionary<Guid, ItemBuyerMaster> { [material.Id] = material }, conversions, out string? body);
            Assert.Null(problem);
            Assert.NotNull(body);
            using JsonDocument json = JsonDocument.Parse(body);
            Assert.Equal("0.400", json.RootElement.GetProperty("to_MaterialDocumentItem")[0].GetProperty("QuantityInEntryUnit").GetString());
            Assert.Equal("KG", json.RootElement.GetProperty("to_MaterialDocumentItem")[0].GetProperty("EntryUnit").GetString());
        }

        [Fact]
        public void TryBuildBody_StopsWhenThePlantOrUnitCannotBePosted()
        {
            (InternalTransferOrder transfer, InventoryLocation from, InventoryLocation to, BuyerProperty source, BuyerProperty destination) document = Document();
            ItemBuyerMaster material = Stock("MAT-A", "KG");
            InternalTransferOrderItem item = Line(material, 1m, "KG");
            Dictionary<Guid, ItemBuyerMaster> materials = new Dictionary<Guid, ItemBuyerMaster> { [material.Id] = material };
            Dictionary<Guid, List<MaterialUomConversion>> conversions = new Dictionary<Guid, List<MaterialUomConversion>>();

            document.destination.PlantCode = "PL-8";
            Assert.Equal(SilaTransferSap.TRANSFER_PLANT_MISMATCH, SilaTransferSap.TryBuildBody(
                document.transfer, document.from, document.to, document.source, document.destination, new[] { item }, materials, conversions, out _));

            document.destination.PlantCode = "PL-9";
            document.to.StorageLocationCode = "AA";
            Assert.Equal(SilaTransferSap.INVALID_TRANSFER_LOCATION, SilaTransferSap.TryBuildBody(
                document.transfer, document.from, document.to, document.source, document.destination, new[] { item }, materials, conversions, out _));

            document.to.StorageLocationCode = null;
            Assert.Equal(SilaTransferSap.DESTINATION_SAP_LOCATION_MAPPING_MISSING, SilaTransferSap.TryBuildBody(
                document.transfer, document.from, document.to, document.source, document.destination, new[] { item }, materials, conversions, out _));

            document.to.StorageLocationCode = "BB";
            material.BaseUnitOfMeasure = "";
            Assert.Equal(SilaTransferSap.UOM_CONVERSION_MISSING, SilaTransferSap.TryBuildBody(
                document.transfer, document.from, document.to, document.source, document.destination, new[] { item }, materials, conversions, out _));

            material.BaseUnitOfMeasure = "KG";
            material.IsActive = false;
            Assert.Equal(SilaTransferSap.MATERIAL_NOT_VALID, SilaTransferSap.TryBuildBody(
                document.transfer, document.from, document.to, document.source, document.destination, new[] { item }, materials, conversions, out _));
        }

        [Fact]
        public void ReadMaterialDocument_KeepsTheNumberAndYear()
        {
            Assert.Equal("4900001234/2026", SilaTransferSap.ReadMaterialDocument("{\"d\":{\"MaterialDocument\":\"4900001234\",\"MaterialDocumentYear\":\"2026\"}}"));
            Assert.Equal("4900001234", SilaTransferSap.ReadMaterialDocument("{\"materialDocument\":\"4900001234\"}"));
            Assert.Null(SilaTransferSap.ReadMaterialDocument("{\"error\":\"no\"}"));
            Assert.Null(SilaTransferSap.ReadMaterialDocument(null));
        }

        private static (InternalTransferOrder transfer, InventoryLocation from, InventoryLocation to, BuyerProperty source, BuyerProperty destination) Document()
        {
            Guid propertyId = Guid.NewGuid();
            return (
                new InternalTransferOrder
                {
                    Id = Guid.NewGuid(),
                    ItoNumber = "ITO-1",
                    Status = "DISPATCHED",
                    DispatchedOn = new DateTime(2026, 10, 16, 15, 4, 0, DateTimeKind.Utc)
                },
                new InventoryLocation { Id = Guid.NewGuid(), PropertyId = propertyId, StorageLocationCode = "AA", LocationCode = "A", LocationName = "A", LocationType = "STORE" },
                new InventoryLocation { Id = Guid.NewGuid(), PropertyId = propertyId, StorageLocationCode = "BB", LocationCode = "B", LocationName = "B", LocationType = "OUTLET" },
                new BuyerProperty { Id = propertyId, PlantCode = "PL-9", CompanyCode = "1000" },
                new BuyerProperty { Id = propertyId, PlantCode = "PL-9", CompanyCode = "1000" });
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

        private static InternalTransferOrderItem Line(ItemBuyerMaster material, decimal quantity, string uom)
        {
            return new InternalTransferOrderItem
            {
                Id = Guid.NewGuid(),
                MaterialId = material.Id,
                MaterialCode = material.MaterialCode,
                MaterialName = material.MaterialCode,
                DispatchedQty = quantity,
                ApprovedQty = quantity,
                Uom = uom,
                IsActive = true
            };
        }
    }
}

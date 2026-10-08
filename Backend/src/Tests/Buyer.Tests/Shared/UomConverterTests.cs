using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Tests.Support;
using SharedKernel.ExceptionHandler;

namespace Buyer.Tests.Shared
{
    public class UomConverterTests
    {
        private static ItemBuyerMaster Material(string? baseUom)
        {
            return new ItemBuyerMaster { Id = Guid.NewGuid(), MaterialCode = "M001", BaseUnitOfMeasure = baseUom! };
        }

        private static Dictionary<Guid, List<MaterialUomConversion>> Conversions(ItemBuyerMaster material, params (string From, string To, decimal Factor)[] rows)
        {
            List<MaterialUomConversion> list = rows
                .Select(x => new MaterialUomConversion { Id = Guid.NewGuid(), MaterialId = material.Id, FromUom = x.From, ToUom = x.To, Factor = x.Factor, IsActive = true })
                .ToList();
            return new Dictionary<Guid, List<MaterialUomConversion>> { [material.Id] = list };
        }

        [Theory]
        [InlineData(null, "EA")]
        [InlineData("", "EA")]
        [InlineData("   ", "EA")]
        [InlineData(" ml ", "ML")]
        [InlineData("KG", "KG")]
        public void BaseUomOf_DefaultsToEaAndNormalises(string? baseUom, string expected)
        {
            Assert.Equal(expected, UomConverter.BaseUomOf(Material(baseUom)));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("ml")]
        [InlineData(" ML ")]
        public void ToBase_BaseOrEmptyUnit_ReturnsQuantityUnchanged(string? uom)
        {
            ItemBuyerMaster material = Material("ML");
            decimal result = UomConverter.ToBase(new FakeLogger(), material, 42.5m, uom, new Dictionary<Guid, List<MaterialUomConversion>>());
            Assert.Equal(42.5m, result);
        }

        [Fact]
        public void ToBase_ForwardConversion_Multiplies()
        {
            ItemBuyerMaster material = Material("ML");
            decimal result = UomConverter.ToBase(new FakeLogger(), material, 2m, "btl", Conversions(material, ("BTL", "ML", 750m)));
            Assert.Equal(1500m, result);
        }

        [Fact]
        public void ToBase_BackwardConversion_Divides()
        {
            ItemBuyerMaster material = Material("BTL");
            decimal result = UomConverter.ToBase(new FakeLogger(), material, 1500m, "ML", Conversions(material, ("BTL", "ML", 750m)));
            Assert.Equal(2m, result);
        }

        [Fact]
        public void ToBase_ConversionUnitsAreTrimmedAndCaseInsensitive()
        {
            ItemBuyerMaster material = Material("ml");
            decimal result = UomConverter.ToBase(new FakeLogger(), material, 1m, "Btl", Conversions(material, (" btl ", " Ml ", 700m)));
            Assert.Equal(700m, result);
        }

        [Fact]
        public void ToBase_ZeroFactorIsIgnored_AndMissingConversionIsBadRequest()
        {
            ItemBuyerMaster material = Material("ML");
            FakeLogger logger = new FakeLogger();
            Assert.Throws<BadRequestCustomException>(() =>
                UomConverter.ToBase(logger, material, 1m, "BTL", Conversions(material, ("BTL", "ML", 0m))));
            Assert.Single(logger.Errors);
        }

        [Fact]
        public void ToBase_NoConversionsForMaterial_IsBadRequest()
        {
            ItemBuyerMaster material = Material("KG");
            FakeLogger logger = new FakeLogger();
            Assert.Throws<BadRequestCustomException>(() =>
                UomConverter.ToBase(logger, material, 1m, "G", new Dictionary<Guid, List<MaterialUomConversion>>()));
            Assert.Single(logger.Errors);
        }

        [Fact]
        public void ToBase_ConversionOfAnotherMaterial_IsNotUsed()
        {
            ItemBuyerMaster material = Material("ML");
            ItemBuyerMaster other = Material("ML");
            Assert.Throws<BadRequestCustomException>(() =>
                UomConverter.ToBase(new FakeLogger(), material, 1m, "BTL", Conversions(other, ("BTL", "ML", 750m))));
        }
    }
}

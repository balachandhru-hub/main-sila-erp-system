using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;

namespace Buyer.Tests.Shared
{
    /// <summary>The pure cost and version rules of recipes.</summary>
    public class SilaRecipeRulesTests
    {
        [Theory]
        [InlineData(25, 100, 25)]
        [InlineData(1, 3, 33.33)]
        [InlineData(2, 3, 66.67)]
        [InlineData(120, 100, 120)]
        public void CostPercent_IsCostOverMenuPriceRoundedToTwoDecimals(decimal cost, decimal price, decimal expected)
        {
            Assert.Equal(expected, SilaRecipeRules.CostPercent(cost, price));
        }

        [Theory]
        [InlineData(25, 100, 75)]
        [InlineData(1, 3, 66.67)]
        [InlineData(120, 100, -20)]
        public void MarginPercent_IsMenuPriceMinusCostOverMenuPrice(decimal cost, decimal price, decimal expected)
        {
            Assert.Equal(expected, SilaRecipeRules.MarginPercent(cost, price));
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-5)]
        public void CostAndMarginPercent_WithoutMenuPrice_AreNull(decimal price)
        {
            Assert.Null(SilaRecipeRules.CostPercent(10m, price));
            Assert.Null(SilaRecipeRules.MarginPercent(10m, price));
        }

        [Theory]
        [InlineData(100, 5, 20)]
        [InlineData(10, 1, 10)]
        [InlineData(10, 3, 3.3333)]
        [InlineData(10, 0, 10)]
        public void CostPerServing_IsTotalCostOverServingQty(decimal totalCost, decimal servingQty, decimal expected)
        {
            Assert.Equal(expected, SilaRecipeRules.CostPerServing(totalCost, servingQty));
        }

        [Fact]
        public void BatchRecipe_CostPercentAndMarginUseCostPerServing()
        {
            // Biryani for 5 costs 100 in total and sells at 50 a plate: 20 per plate = 40 %, margin 30 (60 %).
            decimal perServing = SilaRecipeRules.CostPerServing(100m, 5m);
            Assert.Equal(40m, SilaRecipeRules.CostPercent(perServing, 50m));
            Assert.Equal(30m, SilaRecipeRules.MarginAmount(perServing, 50m));
            Assert.Equal(60m, SilaRecipeRules.MarginPercent(perServing, 50m));
            Assert.Null(SilaRecipeRules.MarginAmount(perServing, 0m));
        }

        [Fact]
        public void SetVersionCost_DraftOfApprovedRecipeKeepsSellingCost()
        {
            Recipe recipe = new Recipe { Version = 2, ActiveVersion = 1, TotalCost = 12m };
            SilaRecipeRules.SetVersionCost(recipe, 15m);
            Assert.Equal(12m, recipe.TotalCost);
            Assert.Equal(15m, recipe.DraftTotalCost);

            SilaRecipeRules.PromoteDraftHeader(recipe);
            Assert.Equal(15m, recipe.TotalCost);
            Assert.Null(recipe.DraftTotalCost);
        }

        [Fact]
        public void SetVersionCost_NeverApprovedRecipeWritesTotalCost()
        {
            Recipe recipe = new Recipe { Version = 1, ActiveVersion = 0, TotalCost = 0m };
            SilaRecipeRules.SetVersionCost(recipe, 9m);
            Assert.Equal(9m, recipe.TotalCost);
            Assert.Null(recipe.DraftTotalCost);
        }

        [Fact]
        public void ClearDraftHeader_DropsDraftCost()
        {
            Recipe recipe = new Recipe { Version = 2, ActiveVersion = 1, TotalCost = 12m, DraftTotalCost = 15m, DraftServingQty = 1m };
            SilaRecipeRules.ClearDraftHeader(recipe);
            Assert.Equal(12m, recipe.TotalCost);
            Assert.Null(recipe.DraftTotalCost);
        }

        [Fact]
        public void ReadinessStatus_ApprovedWithoutDraftIsActive()
        {
            Recipe recipe = new Recipe { Version = 1, ActiveVersion = 1, Status = Common.SILA_RECIPE_APPROVED };
            Assert.Equal(SilaRecipeRules.READINESS_ACTIVE, SilaRecipeRules.ReadinessStatus(recipe, 1, true, 0));
            Assert.Equal(SilaRecipeRules.READINESS_ACTIVE, SilaRecipeRules.ReadinessStatus(recipe, 1, false, 2));
        }

        [Fact]
        public void ReadinessStatus_DraftPendingAndInactive()
        {
            Recipe draft = new Recipe { Version = 2, ActiveVersion = 1, Status = Common.SILA_RECIPE_DRAFT };
            Assert.Equal(SilaRecipeRules.READINESS_READY, SilaRecipeRules.ReadinessStatus(draft, 2, true, 0));
            Assert.Equal("NOT READY (3)", SilaRecipeRules.ReadinessStatus(draft, 2, false, 3));
            Assert.Equal(SilaRecipeRules.READINESS_ACTIVE, SilaRecipeRules.ReadinessStatus(draft, 1, true, 0));

            Recipe pending = new Recipe { Version = 1, ActiveVersion = 0, Status = Common.SILA_RECIPE_PENDING_APPROVAL };
            Assert.Equal(SilaRecipeRules.READINESS_PENDING, SilaRecipeRules.ReadinessStatus(pending, 1, true, 0));

            Recipe inactive = new Recipe { Version = 1, ActiveVersion = 1, Status = Common.SILA_RECIPE_INACTIVE };
            Assert.Equal(SilaRecipeRules.READINESS_INACTIVE, SilaRecipeRules.ReadinessStatus(inactive, 1, true, 0));
        }

        [Fact]
        public void PackSummary_ListsConversions()
        {
            List<MaterialUomConversion> conversions = new List<MaterialUomConversion>
            {
                new MaterialUomConversion { FromUom = "CS", ToUom = "EA", Factor = 12m },
                new MaterialUomConversion { FromUom = "BTL", ToUom = "ML", Factor = 750.5m }
            };
            Assert.Equal("1 CS = 12 EA; 1 BTL = 750.5 ML", SilaRecipeReadiness.PackSummary(conversions));
            Assert.Null(SilaRecipeReadiness.PackSummary(new List<MaterialUomConversion>()));
        }

        [Fact]
        public void VersionStatus_ActiveLatestAndSuperseded()
        {
            Recipe recipe = new Recipe { Version = 3, ActiveVersion = 2, Status = Common.SILA_RECIPE_PENDING_APPROVAL };
            Assert.Equal(SilaRecipeRules.VERSION_SUPERSEDED, SilaRecipeRules.VersionStatus(recipe, 1));
            Assert.Equal(SilaRecipeRules.VERSION_ACTIVE, SilaRecipeRules.VersionStatus(recipe, 2));
            Assert.Equal(Common.SILA_RECIPE_PENDING_APPROVAL, SilaRecipeRules.VersionStatus(recipe, 3));
        }

        [Fact]
        public void VersionStatus_InactiveRecipe_HasNoActiveVersion()
        {
            Recipe recipe = new Recipe { Version = 2, ActiveVersion = 2, Status = Common.SILA_RECIPE_INACTIVE };
            Assert.Equal(Common.SILA_RECIPE_INACTIVE, SilaRecipeRules.VersionStatus(recipe, 2));
        }

        [Fact]
        public void Versions_AreNewestFirst()
        {
            Recipe recipe = new Recipe { Version = 3, ActiveVersion = 1, Status = Common.SILA_RECIPE_DRAFT };
            List<SilaRecipeVersionDto> versions = SilaRecipeRules.Versions(recipe);
            Assert.Equal(new[] { 3, 2, 1 }, versions.Select(x => x.Version));
            Assert.Equal(new[] { Common.SILA_RECIPE_DRAFT, SilaRecipeRules.VERSION_SUPERSEDED, SilaRecipeRules.VERSION_ACTIVE }, versions.Select(x => x.Status));
        }

        [Theory]
        [InlineData(10.0, false, SilaRecipeReadiness.PRICE_APPROVED)]
        [InlineData(10.0, true, SilaRecipeReadiness.PRICE_PENDING)]
        [InlineData(0.0, false, SilaRecipeReadiness.PRICE_MISSING)]
        [InlineData(null, false, SilaRecipeReadiness.PRICE_MISSING)]
        [InlineData(null, true, SilaRecipeReadiness.PRICE_PENDING)]
        public void PriceStatus_PendingWinsThenApprovedWhenPositive(double? unitCost, bool pending, string expected)
        {
            ItemBuyerMaster material = new ItemBuyerMaster { Id = Guid.NewGuid(), UnitCost = unitCost == null ? null : (decimal)unitCost.Value };
            Assert.Equal(expected, SilaRecipeReadiness.PriceStatus(material, pending));
        }

        [Fact]
        public void TryToBase_ConvertsBothWaysAndReturnsNullWhenMissing()
        {
            ItemBuyerMaster material = new ItemBuyerMaster { Id = Guid.NewGuid(), BaseUnitOfMeasure = "ML" };
            List<MaterialUomConversion> conversions = new List<MaterialUomConversion>
            {
                new MaterialUomConversion { MaterialId = material.Id, FromUom = "BTL", ToUom = "ML", Factor = 750m },
                new MaterialUomConversion { MaterialId = material.Id, FromUom = "ML", ToUom = "CL", Factor = 0.1m }
            };
            Assert.Equal(30m, SilaRecipeReadiness.TryToBase(material, 30m, null, conversions));
            Assert.Equal(1500m, SilaRecipeReadiness.TryToBase(material, 2m, "btl", conversions));
            Assert.Equal(40m, SilaRecipeReadiness.TryToBase(material, 4m, "CL", conversions));
            Assert.Null(SilaRecipeReadiness.TryToBase(material, 1m, "KG", conversions));
        }
    }
}

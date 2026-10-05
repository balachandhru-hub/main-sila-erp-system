using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Tests.Support;

namespace Buyer.Tests.Shared
{
    /// <summary>Shortage and substitute ranking of the substitution engine, loaded from an in-memory database.</summary>
    public class SilaSubstitutionContextTests
    {
        private static readonly Guid BuyerId = Guid.NewGuid();
        private static readonly Guid PropertyId = Guid.NewGuid();
        private static readonly Guid OtherPropertyId = Guid.NewGuid();

        private readonly List<object> _rows = new List<object>();
        private readonly InventoryLocation _outlet;
        private readonly InventoryLocation _store;
        private readonly InventoryLocation _otherStore;
        private readonly Recipe _recipe;

        public SilaSubstitutionContextTests()
        {
            _outlet = Location("OUT1", Common.SILA_LOCATION_OUTLET, PropertyId);
            _store = Location("ST1", Common.SILA_LOCATION_STORE, PropertyId);
            _otherStore = Location("ST9", Common.SILA_LOCATION_STORE, OtherPropertyId);
            _recipe = new Recipe
            {
                Id = Guid.NewGuid(),
                BuyerId = BuyerId,
                RecipeCode = "R1",
                Name = "Martini",
                ItemMode = Common.SILA_RECIPE_RECIPE,
                Status = Common.SILA_RECIPE_APPROVED,
                Version = 1,
                ActiveVersion = 1,
                IsActive = true
            };
            _rows.Add(_recipe);
            _rows.Add(new RecipeOutletPrice { Id = Guid.NewGuid(), RecipeId = _recipe.Id, OutletLocationId = _outlet.Id, MenuPrice = 40m, Version = 1, IsActive = true });
        }

        private InventoryLocation Location(string code, string type, Guid propertyId)
        {
            InventoryLocation location = new InventoryLocation
            {
                Id = Guid.NewGuid(),
                BuyerId = BuyerId,
                PropertyId = propertyId,
                LocationCode = code,
                LocationName = code,
                LocationType = type,
                IsActive = true
            };
            _rows.Add(location);
            return location;
        }

        private ItemBuyerMaster Material(string code, decimal? unitCost, string group = "VODKA", string baseUom = "ML")
        {
            ItemBuyerMaster material = new ItemBuyerMaster
            {
                Id = Guid.NewGuid(),
                BuyerId = BuyerId,
                MaterialCode = code,
                Description = code,
                MaterialGroup = group,
                BaseUnitOfMeasure = baseUom,
                UnitCost = unitCost,
                IsInventoryItem = true,
                IsActive = true
            };
            _rows.Add(material);
            return material;
        }

        private void Stock(InventoryLocation location, ItemBuyerMaster material, decimal onHand)
        {
            _rows.Add(new InventoryBalance { Id = Guid.NewGuid(), BuyerId = BuyerId, LocationId = location.Id, MaterialId = material.Id, OnHandQty = onHand, IsActive = true });
        }

        private RecipeIngredient Ingredient(ItemBuyerMaster material, decimal quantity, string uom, decimal cost)
        {
            RecipeIngredient line = new RecipeIngredient
            {
                Id = Guid.NewGuid(),
                RecipeId = _recipe.Id,
                MaterialId = material.Id,
                ItemCode = material.MaterialCode,
                ItemName = material.Description,
                Quantity = quantity,
                Uom = uom,
                BaseQuantity = quantity,
                BaseUom = "ML",
                Cost = cost,
                Version = 1,
                IsActive = true
            };
            _rows.Add(line);
            return line;
        }

        private async Task<SilaSubstitutionContext> Load(TestDatabase db)
        {
            db.Seed(_rows.ToArray());
            return await SilaSubstitutionContext.LoadAsync(db.Repository, BuyerId, new List<Recipe> { _recipe }, CancellationToken.None);
        }

        [Fact]
        public async Task Candidates_RankedByStockThenClosestCostThenCode_WithIneligibleMaterialsLeftOut()
        {
            using TestDatabase db = new TestDatabase();
            ItemBuyerMaster current = Material("CUR", 0.05m);
            RecipeIngredient line = Ingredient(current, 30m, "ML", 1.5m);
            Stock(_store, current, 0m);

            ItemBuyerMaster most = Material("MOST", 0.10m);       // most stock wins although its cost is furthest
            Stock(_store, most, 6000m);
            ItemBuyerMaster close = Material("CLOSE", 0.06m);     // 1.80, delta 0.30
            Stock(_store, close, 3000m);
            ItemBuyerMaster far = Material("FAR", 0.08m);         // 2.40, delta 0.90
            Stock(_outlet, far, 1000m);
            Stock(_store, far, 2000m);
            ItemBuyerMaster tieB = Material("TIE-B", 0.04m);      // 1.20, delta -0.30: same distance as CLOSE, ordered by code
            Stock(_store, tieB, 3000m);

            ItemBuyerMaster otherGroup = Material("GIN", 0.05m, "GIN");
            Stock(_store, otherGroup, 9000m);
            ItemBuyerMaster unpriced = Material("UNPRICED", null);
            Stock(_store, unpriced, 9000m);
            ItemBuyerMaster otherProperty = Material("ELSEWHERE", 0.05m);
            Stock(_otherStore, otherProperty, 9000m);
            ItemBuyerMaster pieces = Material("PIECES", 0.05m, baseUom: "EA"); // no ML conversion
            Stock(_store, pieces, 9000m);
            ItemBuyerMaster inRecipe = Material("INRECIPE", 0.05m);
            Ingredient(inRecipe, 10m, "ML", 0.5m);
            Stock(_store, inRecipe, 9000m);

            SilaSubstitutionContext context = await Load(db);
            List<SilaSubstitutionCandidate> candidates = context.Candidates(_recipe.Id, line, PropertyId);

            Assert.Equal(new[] { "MOST", "CLOSE", "TIE-B", "FAR" }, candidates.Select(x => x.Material.MaterialCode));
            Assert.Equal(new[] { 6000m, 3000m, 3000m, 3000m }, candidates.Select(x => x.Available));
            SilaSubstitutionCandidate closeLine = candidates[1];
            Assert.Equal(30m, closeLine.Quantity);
            Assert.Equal("ML", closeLine.Uom);
            Assert.Equal(30m, closeLine.BaseQuantity);
            Assert.Equal(1.8m, closeLine.LineCost);
            Assert.Equal(0.3m, closeLine.CostDelta);
        }

        [Fact]
        public async Task Candidates_KeepTheIngredientUnitWhenTheSubstituteConvertsIt_ElseUseTheBaseQuantity()
        {
            using TestDatabase db = new TestDatabase();
            ItemBuyerMaster current = Material("CUR", 0.05m);
            _rows.Add(new MaterialUomConversion { Id = Guid.NewGuid(), BuyerId = BuyerId, MaterialId = current.Id, FromUom = "CL", ToUom = "ML", Factor = 10m, IsActive = true });
            RecipeIngredient line = Ingredient(current, 3m, "CL", 1.5m);
            Stock(_store, current, 0m);

            ItemBuyerMaster withCl = Material("WITHCL", 0.05m);
            _rows.Add(new MaterialUomConversion { Id = Guid.NewGuid(), BuyerId = BuyerId, MaterialId = withCl.Id, FromUom = "CL", ToUom = "ML", Factor = 10m, IsActive = true });
            Stock(_store, withCl, 500m);
            ItemBuyerMaster mlOnly = Material("MLONLY", 0.05m);
            Stock(_store, mlOnly, 400m);

            SilaSubstitutionContext context = await Load(db);
            List<SilaSubstitutionCandidate> candidates = context.Candidates(_recipe.Id, line, PropertyId);

            Assert.Equal(2, candidates.Count);
            Assert.Equal(("WITHCL", 3m, "CL", 30m), (candidates[0].Material.MaterialCode, candidates[0].Quantity, candidates[0].Uom, candidates[0].BaseQuantity));
            Assert.Equal(("MLONLY", 30m, "ML", 30m), (candidates[1].Material.MaterialCode, candidates[1].Quantity, candidates[1].Uom, candidates[1].BaseQuantity));
        }

        [Fact]
        public async Task IsShort_WhenNothingLeftOrBelowTheOutletsMinimum()
        {
            using TestDatabase db = new TestDatabase();
            ItemBuyerMaster empty = Material("EMPTY", 0.05m);
            Ingredient(empty, 30m, "ML", 1.5m);
            ItemBuyerMaster low = Material("LOW", 0.05m);
            Ingredient(low, 30m, "ML", 1.5m);
            Stock(_store, low, 10m);
            ItemBuyerMaster enough = Material("ENOUGH", 0.05m);
            Ingredient(enough, 30m, "ML", 1.5m);
            Stock(_store, enough, 15m);
            Stock(_outlet, enough, 10m);
            ItemBuyerMaster noMinimum = Material("NOMIN", 0.05m);
            Ingredient(noMinimum, 30m, "ML", 1.5m);
            Stock(_store, noMinimum, 1m);
            _rows.Add(new InventoryLocationMaterial { Id = Guid.NewGuid(), LocationId = _outlet.Id, MaterialId = low.Id, MinimumStock = 20m, IsActive = true });
            _rows.Add(new InventoryLocationMaterial { Id = Guid.NewGuid(), LocationId = _outlet.Id, MaterialId = enough.Id, MinimumStock = 20m, IsActive = true });

            SilaSubstitutionContext context = await Load(db);

            Assert.True(context.IsShort(PropertyId, empty.Id));
            Assert.True(context.IsShort(PropertyId, low.Id));
            Assert.False(context.IsShort(PropertyId, enough.Id));
            Assert.False(context.IsShort(PropertyId, noMinimum.Id));
            Assert.Equal(25m, context.Available(PropertyId, enough.Id));
            Assert.Equal(20m, context.OutletMinimum(PropertyId, low.Id));
            Assert.Equal(0m, context.Available(OtherPropertyId, enough.Id));
        }

        [Fact]
        public async Task FirstOutletPerProperty_UsesThePricedOutlets()
        {
            using TestDatabase db = new TestDatabase();
            SilaSubstitutionContext context = await Load(db);

            InventoryLocation outlet = Assert.Single(context.FirstOutletPerProperty(_recipe.Id));
            Assert.Equal(_outlet.Id, outlet.Id);
        }
    }
}

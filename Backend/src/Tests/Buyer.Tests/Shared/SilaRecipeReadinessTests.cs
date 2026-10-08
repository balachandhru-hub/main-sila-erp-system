using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Tests.Support;

namespace Buyer.Tests.Shared
{
    /// <summary>Recipe readiness for approval, loaded through the real RepositoryWrapper from an in-memory database.</summary>
    public class SilaRecipeReadinessTests
    {
        private static readonly Guid BuyerId = Guid.NewGuid();

        private static ItemBuyerMaster Material(string code, decimal? unitCost, string baseUom = "ML")
        {
            return new ItemBuyerMaster
            {
                Id = Guid.NewGuid(),
                BuyerId = BuyerId,
                MaterialCode = code,
                Description = code,
                MaterialGroup = "SPIRITS",
                BaseUnitOfMeasure = baseUom,
                UnitCost = unitCost,
                IsInventoryItem = true,
                IsActive = true
            };
        }

        private static Recipe NewRecipe(string itemMode = Common.SILA_RECIPE_RECIPE, int version = 1)
        {
            return new Recipe
            {
                Id = Guid.NewGuid(),
                BuyerId = BuyerId,
                RecipeCode = "R" + Guid.NewGuid().ToString("N")[..6],
                Name = "Cocktail",
                ItemMode = itemMode,
                Status = Common.SILA_RECIPE_DRAFT,
                Version = version,
                IsActive = true
            };
        }

        private static RecipeIngredient Line(Recipe recipe, ItemBuyerMaster? material, decimal quantity, string uom, int version = 1, Guid? subRecipeId = null)
        {
            return new RecipeIngredient
            {
                Id = Guid.NewGuid(),
                RecipeId = recipe.Id,
                MaterialId = material?.Id,
                SubRecipeId = subRecipeId,
                ItemCode = material?.MaterialCode ?? "SUB",
                ItemName = material?.Description ?? "Sub recipe",
                Quantity = quantity,
                Uom = uom,
                Version = version,
                IsActive = true
            };
        }

        private static RecipeOutletPrice Price(Recipe recipe, int version = 1)
        {
            return new RecipeOutletPrice { Id = Guid.NewGuid(), RecipeId = recipe.Id, OutletLocationId = Guid.NewGuid(), MenuPrice = 50m, Version = version, IsActive = true };
        }

        private static MaterialUomConversion Conversion(ItemBuyerMaster material, string from, string to, decimal factor)
        {
            return new MaterialUomConversion { Id = Guid.NewGuid(), BuyerId = BuyerId, MaterialId = material.Id, FromUom = from, ToUom = to, Factor = factor, IsActive = true };
        }

        private static async Task<SilaRecipeReadinessDto> Evaluate(TestDatabase db, Recipe recipe, int version = 1)
        {
            SilaRecipeReadiness readiness = await SilaRecipeReadiness.LoadAsync(db.Repository, BuyerId, new[] { recipe.Id }, CancellationToken.None);
            return readiness.Evaluate(recipe, version);
        }

        [Fact]
        public async Task CompleteRecipe_IsReadyAndCostComplete()
        {
            using TestDatabase db = new TestDatabase();
            ItemBuyerMaster vodka = Material("VODKA", 0.05m);
            Recipe recipe = NewRecipe();
            db.Seed(vodka, recipe, Conversion(vodka, "BTL", "ML", 750m), Line(recipe, vodka, 1m, "BTL"), Price(recipe));

            SilaRecipeReadiness readiness = await SilaRecipeReadiness.LoadAsync(db.Repository, BuyerId, new[] { recipe.Id }, CancellationToken.None);
            SilaRecipeReadinessDto result = readiness.Evaluate(recipe, 1);

            Assert.True(result.Ready, string.Join("; ", result.Issues));
            Assert.True(result.CostComplete);
            Assert.Empty(result.Issues);
            RecipeIngredient line = Assert.Single(readiness.IngredientsOf(recipe.Id, 1));
            Assert.Equal(750m, readiness.BaseQuantityOf(line));
            Assert.Equal(SilaRecipeReadiness.PRICE_APPROVED, readiness.PriceStatusOf(line));
        }

        [Fact]
        public async Task EmptyVersion_HasNoIngredientsAndNoMenuPrice()
        {
            using TestDatabase db = new TestDatabase();
            Recipe recipe = NewRecipe();
            db.Seed(recipe);

            SilaRecipeReadinessDto result = await Evaluate(db, recipe);

            Assert.False(result.Ready);
            Assert.False(result.CostComplete);
            Assert.Equal(new[] { "No ingredients", "No outlet menu price" }, result.Issues);
        }

        [Fact]
        public async Task MissingPricePendingPriceAndMissingConversion_AreLineIssues()
        {
            using TestDatabase db = new TestDatabase();
            ItemBuyerMaster unpriced = Material("UNPRICED", null);
            ItemBuyerMaster pending = Material("PENDING", 0.1m);
            ItemBuyerMaster noConversion = Material("NOCONV", 0.1m);
            Recipe recipe = NewRecipe();
            MaterialPriceChange change = new MaterialPriceChange
            {
                Id = Guid.NewGuid(),
                BuyerId = BuyerId,
                MaterialId = pending.Id,
                RequestNumber = "MP000001",
                Reason = "Supplier increase",
                Status = Common.SILA_PRICE_PENDING_APPROVAL,
                IsActive = true
            };
            db.Seed(unpriced, pending, noConversion, recipe, change,
                Line(recipe, unpriced, 30m, "ML"), Line(recipe, pending, 30m, "ML"), Line(recipe, noConversion, 1m, "BTL"), Price(recipe));

            SilaRecipeReadinessDto result = await Evaluate(db, recipe);

            Assert.False(result.Ready);
            Assert.False(result.CostComplete);
            Assert.Equal(3, result.Issues.Count);
            Assert.Contains(result.Issues, x => x.StartsWith("UNPRICED") && x.EndsWith("Price missing"));
            Assert.Contains(result.Issues, x => x.StartsWith("PENDING") && x.EndsWith("Material price pending approval"));
            Assert.Contains(result.Issues, x => x.StartsWith("NOCONV") && x.Contains("UOM conversion missing (BTL to ML)"));
        }

        [Fact]
        public async Task OutletPrice_CoversAMaterialWithNoDefaultPrice_OnlyAtThatOutlet()
        {
            using TestDatabase db = new TestDatabase();
            ItemBuyerMaster chicken = Material("CHICKEN", null, "G");
            Recipe recipe = NewRecipe();
            RecipeOutletPrice priced = Price(recipe);
            RecipeOutletPrice other = Price(recipe);
            MaterialOutletPrice outletPrice = new MaterialOutletPrice
            {
                Id = Guid.NewGuid(), BuyerId = BuyerId, MaterialId = chicken.Id, OutletLocationId = priced.OutletLocationId, UnitCost = 0.4m, IsActive = true
            };
            db.Seed(chicken, recipe, outletPrice, Line(recipe, chicken, 500m, "G"), priced);

            SilaRecipeReadiness readiness = await SilaRecipeReadiness.LoadAsync(db.Repository, BuyerId, new[] { recipe.Id }, CancellationToken.None);
            Assert.True(readiness.Evaluate(recipe, 1).Ready);
            Assert.Equal(0.4m, readiness.UnitCostAt(chicken, priced.OutletLocationId));
            Assert.Null(readiness.UnitCostAt(chicken, other.OutletLocationId));
            Assert.Null(readiness.UnitCostAt(chicken, null));

            // A second outlet with a menu price but no price for the material is not ready.
            db.Seed(other);
            readiness = await SilaRecipeReadiness.LoadAsync(db.Repository, BuyerId, new[] { recipe.Id }, CancellationToken.None);
            SilaRecipeReadinessDto result = readiness.Evaluate(recipe, 1);
            Assert.False(result.Ready);
            Assert.Contains(result.Issues, x => x.StartsWith("CHICKEN") && x.EndsWith("Price missing"));
        }

        [Fact]
        public async Task OutletWithoutItsOwnPrice_FallsBackToTheDefaultPrice()
        {
            using TestDatabase db = new TestDatabase();
            ItemBuyerMaster onion = Material("ONION", 0.1m, "G");
            Recipe recipe = NewRecipe();
            Guid outlet = Guid.NewGuid();
            db.Seed(onion, recipe, new MaterialOutletPrice { Id = Guid.NewGuid(), BuyerId = BuyerId, MaterialId = onion.Id, OutletLocationId = outlet, UnitCost = 0.3m, IsActive = true });

            SilaRecipeReadiness readiness = await SilaRecipeReadiness.LoadAsync(db.Repository, BuyerId, new[] { recipe.Id }, CancellationToken.None);
            Assert.Equal(0.1m, readiness.UnitCostAt(onion, Guid.NewGuid()));
        }

        [Fact]
        public async Task InactiveOrUnknownMaterial_IsALineIssue()
        {
            using TestDatabase db = new TestDatabase();
            ItemBuyerMaster inactive = Material("OLD", 0.1m);
            inactive.IsActive = false;
            Recipe recipe = NewRecipe();
            db.Seed(inactive, recipe, Line(recipe, inactive, 30m, "ML"), Price(recipe));

            SilaRecipeReadinessDto result = await Evaluate(db, recipe);

            Assert.False(result.CostComplete);
            Assert.Contains(result.Issues, x => x.EndsWith("Material is inactive or missing"));
        }

        [Fact]
        public async Task DirectItem_NeedsExactlyOneIngredient_ButCostCanStillBeComplete()
        {
            using TestDatabase db = new TestDatabase();
            ItemBuyerMaster beer = Material("BEER", 5m, "EA");
            ItemBuyerMaster lime = Material("LIME", 0.5m, "EA");
            Recipe recipe = NewRecipe(Common.SILA_RECIPE_DIRECT);
            db.Seed(beer, lime, recipe, Line(recipe, beer, 1m, "EA"), Line(recipe, lime, 1m, "EA"), Price(recipe));

            SilaRecipeReadinessDto result = await Evaluate(db, recipe);

            Assert.False(result.Ready);
            Assert.True(result.CostComplete);
            Assert.Equal(new[] { "A DIRECT item needs exactly one ingredient" }, result.Issues);
        }

        [Fact]
        public async Task SubRecipe_MustHaveAnApprovedActiveVersion()
        {
            using TestDatabase db = new TestDatabase();
            Recipe approvedSub = NewRecipe(Common.SILA_RECIPE_BATCH);
            approvedSub.ActiveVersion = 1;
            approvedSub.Status = Common.SILA_RECIPE_APPROVED;
            Recipe draftSub = NewRecipe(Common.SILA_RECIPE_BATCH);
            Recipe inactiveSub = NewRecipe(Common.SILA_RECIPE_BATCH);
            inactiveSub.ActiveVersion = 1;
            inactiveSub.Status = Common.SILA_RECIPE_INACTIVE;
            Recipe recipe = NewRecipe();
            db.Seed(approvedSub, draftSub, inactiveSub, recipe,
                Line(recipe, null, 1m, "EA", subRecipeId: approvedSub.Id), Price(recipe));

            Assert.True((await Evaluate(db, recipe)).Ready);

            Recipe second = NewRecipe();
            db.Seed(second, Line(second, null, 1m, "EA", subRecipeId: draftSub.Id), Line(second, null, 1m, "EA", subRecipeId: inactiveSub.Id), Price(second));
            SilaRecipeReadinessDto result = await Evaluate(db, second);
            Assert.Equal(2, result.Issues.Count(x => x.EndsWith("Sub-recipe has no approved version")));
        }

        [Fact]
        public async Task OnlyTheEvaluatedVersionsRowsCount()
        {
            using TestDatabase db = new TestDatabase();
            ItemBuyerMaster vodka = Material("VODKA", 0.05m);
            Recipe recipe = NewRecipe(version: 2);
            db.Seed(vodka, recipe, Line(recipe, vodka, 30m, "ML", version: 1), Price(recipe, 1));

            Assert.True((await Evaluate(db, recipe, 1)).Ready);
            Assert.Equal(new[] { "No ingredients", "No outlet menu price" }, (await Evaluate(db, recipe, 2)).Issues);
        }
    }
}

using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Tests.Support;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Tests.Shared
{
    public class DocumentNumberSequenceTests
    {
        [Fact]
        public async Task NextAsync_FirstUse_SeedsFromHighestExistingNumber()
        {
            using TestDatabase db = new TestDatabase();
            Guid buyerId = Guid.NewGuid();
            db.Seed(
                new StockAdjustment { Id = Guid.NewGuid(), BuyerId = buyerId, AdjustmentNumber = "ADJ000007", IsActive = true },
                new StockAdjustment { Id = Guid.NewGuid(), BuyerId = buyerId, AdjustmentNumber = "ADJ000012", IsActive = true },
                new StockAdjustment { Id = Guid.NewGuid(), BuyerId = Guid.NewGuid(), AdjustmentNumber = "ADJ000099", IsActive = true });

            string first = await DocumentNumber.NextAsync(db.Repository, buyerId, DocumentNumber.ADJUSTMENT, 6, CancellationToken.None);
            string second = await DocumentNumber.NextAsync(db.Repository, buyerId, DocumentNumber.ADJUSTMENT, 6, CancellationToken.None);

            Assert.Equal("ADJ000013", first);
            Assert.Equal("ADJ000014", second);
        }

        [Fact]
        public async Task NextAsync_AfterSave_ContinuesFromTheSequenceRow()
        {
            using TestDatabase db = new TestDatabase();
            Guid buyerId = Guid.NewGuid();
            await DocumentNumber.NextAsync(db.Repository, buyerId, DocumentNumber.RECIPE, 5, CancellationToken.None);
            await db.Context.SaveChangesAsync();
            DocumentNumber.Reset(db.Repository);
            db.Context.ChangeTracker.Clear();

            string next = await DocumentNumber.NextAsync(db.Repository, buyerId, DocumentNumber.RECIPE, 5, CancellationToken.None);
            await db.Context.SaveChangesAsync();

            Assert.Equal("RI00002", next);
            SilaDocumentSequence row = await db.Context.SilaDocumentSequence.AsNoTracking().SingleAsync(x => x.BuyerId == buyerId);
            Assert.Equal(2, row.LastNumber);
        }

        [Theory]
        [InlineData("ITO000015", "ITO", 15)]
        [InlineData("RI00003", "RI", 3)]
        [InlineData("RIBEYE", "RI", null)]
        [InlineData("IT000001", "ITO", null)]
        public void ParseSequence_ReadsOnlyPrefixPlusDigits(string number, string prefix, int? expected)
        {
            Assert.Equal(expected, DocumentNumber.ParseSequence(number, prefix));
        }
    }
}

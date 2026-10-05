namespace Buyer.Domain.Dtos
{
    /// <summary>Cost controller decision on one count line: ACCEPT, RECOUNT, MORE_INFORMATION or REJECT.</summary>
    public class SilaStockCountItemReviewDto
    {
        public string Decision { get; set; } = string.Empty;
        public string? Comment { get; set; }
    }
}

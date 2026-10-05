namespace Buyer.Domain.Dtos
{
    /// <summary>A suggested goods issue line: the approved weekly bucket quantity not yet issued.</summary>
    public class SilaGoodsIssueBucketLineDto
    {
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public decimal ApprovedQuantity { get; set; }
        public decimal IssuedQuantity { get; set; }
        public decimal RemainingQuantity { get; set; }
        public string Uom { get; set; } = string.Empty;
    }
}

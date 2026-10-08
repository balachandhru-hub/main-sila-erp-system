namespace Buyer.Domain.Dtos
{
    public class SilaGoodsIssueLineWriteDto
    {
        public Guid MaterialId { get; set; }
        public decimal Quantity { get; set; }
        public string? Uom { get; set; }
    }
}

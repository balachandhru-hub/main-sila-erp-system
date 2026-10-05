namespace Buyer.Domain.Dtos
{
    /// <summary>AdjustmentType: OPENING_STOCK, WASTE, DAMAGE, BREAKAGE, SPOILAGE, EXPIRED or MANUAL_ADJUSTMENT.</summary>
    public class SilaAdjustmentWriteDto
    {
        public Guid LocationId { get; set; }
        public string AdjustmentType { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public List<SilaAdjustmentLineWriteDto> Items { get; set; } = new();
    }
}

namespace Buyer.Domain.Dtos
{
    public class SilaStockCountWriteDto
    {
        public Guid LocationId { get; set; }
        public string CountType { get; set; } = string.Empty;
        public bool BlindCount { get; set; }
        public string? Notes { get; set; }

        /// <summary>The trading day the count is for; today when empty.</summary>
        public DateTime? BusinessDate { get; set; }
    }
}

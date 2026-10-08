namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// The check of a goods receipt before it is posted: nothing is written.
    /// </summary>
    public class SilaReceivingGrnValidationDto
    {
        public bool Valid { get; set; }
        public List<string> Errors { get; set; } = new();
        public List<string> Warnings { get; set; } = new();
        public List<SilaReceivingGrnValidationLineDto> Lines { get; set; } = new();
        public decimal TotalReceived { get; set; }
        public decimal TotalAccepted { get; set; }
        /// <summary>Accepted quantity at the purchase order price, when every line has a price.</summary>
        public decimal? TotalValue { get; set; }
        public string? Currency { get; set; }
    }
}

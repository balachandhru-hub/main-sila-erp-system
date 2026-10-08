namespace Buyer.Domain.Dtos
{
    /// <summary>One sold line read from a sales file or the POS sales API, before it is stored.</summary>
    public class SilaPosSaleRowDto
    {
        public int RowNumber { get; set; }
        public DateTime BusinessDate { get; set; }
        public string TransactionId { get; set; } = string.Empty;
        public int LineId { get; set; }
        public string PosCode { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public string OutletCode { get; set; } = string.Empty;
        public decimal? Amount { get; set; }
        public string? Uom { get; set; }
        public string? Currency { get; set; }
    }
}

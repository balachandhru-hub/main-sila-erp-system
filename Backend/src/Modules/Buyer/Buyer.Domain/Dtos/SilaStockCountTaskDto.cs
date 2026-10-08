namespace Buyer.Domain.Dtos
{
    public class SilaStockCountTaskDto
    {
        /// <summary>STOCK_COUNT or SHORTAGE_ENQUIRY.</summary>
        public string TaskType { get; set; } = string.Empty;
        public Guid ReferenceId { get; set; }
        public Guid StockCountId { get; set; }
        public string Number { get; set; } = string.Empty;
        public string? LocationName { get; set; }
        public string Detail { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime DateCreated { get; set; }
    }
}

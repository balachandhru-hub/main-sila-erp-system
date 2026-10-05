namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// One purchase order line. MaterialId is null when no Item Master material has the material code of the line (received, not stocked).
    /// </summary>
    public class SilaReceivingPoLineDto
    {
        public Guid Id { get; set; }
        public int LineNumber { get; set; }
        public string? MaterialCode { get; set; }
        public Guid? MaterialId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string? Uom { get; set; }
        public decimal? UnitPrice { get; set; }
        public decimal OrderedQty { get; set; }
        public decimal ReceivedQty { get; set; }
        public decimal OpenQty { get; set; }
        /// <summary>OPEN | PARTIALLY_RECEIVED | RECEIVED</summary>
        public string Status { get; set; } = string.Empty;
        /// <summary>A goods receipt is expected (false for service lines and lines the ERP marks so).</summary>
        public bool GoodsReceiptExpected { get; set; }
        /// <summary>ERP item number (line number, 5 digits).</summary>
        public string ItemNumber { get; set; } = string.Empty;
        /// <summary>The material needs a batch number on receipt.</summary>
        public bool BatchManaged { get; set; }
        /// <summary>The material needs an expiry date on receipt.</summary>
        public bool ExpiryManaged { get; set; }
        public int? ShelfLifeDays { get; set; }
    }
}

namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Pull purchase orders from GET_PO by company code and order-date range. When <see cref="Commit"/> is false the
    /// ERP is read and checked only; the database is updated after confirmation.
    /// </summary>
    public class SilaPurchaseOrderPullWriteDto
    {
        public string? CompanyCode { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        /// <summary>False = preview (no DB write). True = write after checks.</summary>
        public bool Commit { get; set; }
    }
}

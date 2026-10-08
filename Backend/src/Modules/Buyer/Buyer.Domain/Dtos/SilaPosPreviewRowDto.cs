namespace Buyer.Domain.Dtos
{
    /// <summary>One line of a previewed sales file and the outcome of its validation.</summary>
    public class SilaPosPreviewRowDto
    {
        public int RowNumber { get; set; }
        /// <summary>READY | INVALID | DUPLICATE | UNMAPPED_POS_CODE | INVALID_OUTLET | INVALID_UOM | RECIPE_NOT_READY</summary>
        public string Status { get; set; } = string.Empty;
        public string? BusinessDate { get; set; }
        public string? TransactionId { get; set; }
        public string? LineId { get; set; }
        public string? PosCode { get; set; }
        public string? Quantity { get; set; }
        public string? Uom { get; set; }
        public string? OutletCode { get; set; }
        public string? Currency { get; set; }
        public string? Amount { get; set; }
        public string? OutletLocationName { get; set; }
        public string? RecipeCode { get; set; }
        public string? Message { get; set; }
    }
}

namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// A physical count of one material: full units plus optional open units in another unit,
    /// e.g. 2 BTL + 300 ML. Both are converted to the base unit and added.
    /// </summary>
    public class SilaStockCountItemWriteDto
    {
        /// <summary>Only when adding a material that is not on the count sheet.</summary>
        public Guid? MaterialId { get; set; }
        public decimal FullQty { get; set; }
        public string? FullUom { get; set; }
        public decimal? OpenQty { get; set; }
        public string? OpenUom { get; set; }
        /// <summary>BARCODE, SEARCH, MANUAL or PHOTO. Defaults to MANUAL.</summary>
        public string? Method { get; set; }
    }
}

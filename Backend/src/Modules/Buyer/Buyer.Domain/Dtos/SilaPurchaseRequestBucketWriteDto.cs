namespace Buyer.Domain.Dtos
{
    /// <summary>Adds a purchase request to the current weekly bucket of its outlet.</summary>
    public class SilaPurchaseRequestBucketWriteDto
    {
        /// <summary>Quantity of the catalog product; default: the requested quantity.</summary>
        public decimal? Quantity { get; set; }
        /// <summary>The catalog product, when the material is mapped to more than one; default: the first mapping.</summary>
        public Guid? CatalogId { get; set; }
    }
}

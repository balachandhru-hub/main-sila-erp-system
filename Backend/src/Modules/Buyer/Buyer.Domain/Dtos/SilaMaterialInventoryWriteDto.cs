namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// The inventory fields of an Item Master material. The unit price is not part of it: a price changes only through an
    /// approved price change request.
    /// </summary>
    public class SilaMaterialInventoryWriteDto
    {
        /// <summary>Unique per buyer when set.</summary>
        public string? Barcode { get; set; }
        public bool IsInventoryItem { get; set; }
        /// <summary>STOCK | NON_STOCK | SERVICE. STOCK makes the material an inventory item.</summary>
        public string? InventoryType { get; set; }
        public bool BatchManaged { get; set; }
        public bool ExpiryManaged { get; set; }
        /// <summary>Required (1-3650) when the material is expiry managed.</summary>
        public int? ShelfLifeDays { get; set; }
        public bool SerialManaged { get; set; }
        public decimal? StandardPrice { get; set; }
        public decimal? MovingAveragePrice { get; set; }
    }
}

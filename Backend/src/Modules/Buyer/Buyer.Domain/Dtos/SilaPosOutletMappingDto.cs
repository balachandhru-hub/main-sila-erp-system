namespace Buyer.Domain.Dtos
{
    /// <summary>A POS outlet code mapped to a SILA outlet location, with its property, SAP plant and storage location.</summary>
    public class SilaPosOutletMappingDto
    {
        public Guid Id { get; set; }
        public Guid PosSourceId { get; set; }
        public string PosOutletCode { get; set; } = string.Empty;
        public string? PosOutletName { get; set; }
        public Guid OutletLocationId { get; set; }
        public string? LocationCode { get; set; }
        public string? LocationName { get; set; }
        public string? PropertyName { get; set; }
        public string? PlantCode { get; set; }
        public string? StorageLocationCode { get; set; }
        /// <summary>False when the mapped location is no longer an active outlet location.</summary>
        public bool LocationActive { get; set; }
    }
}

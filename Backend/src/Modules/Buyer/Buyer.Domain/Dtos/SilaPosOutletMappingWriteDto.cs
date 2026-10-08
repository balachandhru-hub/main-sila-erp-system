namespace Buyer.Domain.Dtos
{
    public class SilaPosOutletMappingWriteDto
    {
        public string PosOutletCode { get; set; } = string.Empty;
        public string? PosOutletName { get; set; }
        public Guid OutletLocationId { get; set; }
    }
}

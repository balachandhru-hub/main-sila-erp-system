namespace Buyer.Domain.Dtos
{
    /// <summary>Selected replenishment rows: one STANDARD transfer is raised per source and destination pair.</summary>
    public class SilaReplenishmentWriteDto
    {
        public List<SilaReplenishmentLineWriteDto> Lines { get; set; } = new();
    }
}

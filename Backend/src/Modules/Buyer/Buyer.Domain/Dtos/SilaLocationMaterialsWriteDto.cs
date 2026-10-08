namespace Buyer.Domain.Dtos
{
    /// <summary>The full list of stocking rows of a location; rows left out are removed.</summary>
    public class SilaLocationMaterialsWriteDto
    {
        public List<SilaLocationMaterialItemWriteDto> Items { get; set; } = new();
    }
}

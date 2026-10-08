namespace Buyer.Domain.Dtos
{
    /// <summary>Approve or receive: the quantity per line. A line that is not sent keeps the quantity of the previous step.</summary>
    public class SilaTransferQuantitiesDto
    {
        public List<SilaTransferLineQuantityDto> Items { get; set; } = new();
        public string? Comment { get; set; }
    }
}

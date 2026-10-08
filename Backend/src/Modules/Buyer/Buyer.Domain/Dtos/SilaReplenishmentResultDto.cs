namespace Buyer.Domain.Dtos
{
    /// <summary>The transfers raised for the selected replenishment rows.</summary>
    public class SilaReplenishmentResultDto
    {
        public List<SilaTransferListItemDto> Transfers { get; set; } = new();
    }
}

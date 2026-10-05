namespace Buyer.Domain.Dtos
{
    /// <summary>An approver's comment on a material price change; required to reject.</summary>
    public class SilaPriceDecisionWriteDto
    {
        public string? Comment { get; set; }
    }
}

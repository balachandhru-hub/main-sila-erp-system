namespace Buyer.Domain.Dtos
{
    /// <summary>One approver level of a material price change.</summary>
    public class SilaPriceApprovalStepDto
    {
        public Guid UserId { get; set; }
        public string? Name { get; set; }
        public int Order { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Comment { get; set; }
        public DateTime? ActedOn { get; set; }
    }
}

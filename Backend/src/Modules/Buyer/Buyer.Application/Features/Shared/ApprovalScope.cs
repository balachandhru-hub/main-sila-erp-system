namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Where a document applies, used to pick the most specific approval flow: the location (outlet or store), its
    /// property and the property's company code. Any of them may be unknown.
    /// </summary>
    public class ApprovalScope
    {
        public Guid? LocationId { get; set; }
        public Guid? PropertyId { get; set; }
        public string? CompanyCode { get; set; }
    }
}

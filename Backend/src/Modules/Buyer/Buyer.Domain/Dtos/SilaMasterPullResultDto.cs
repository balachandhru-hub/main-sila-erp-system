namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// The result of reading suppliers or purchase orders from the ERP.
    /// </summary>
    public class SilaMasterPullResultDto
    {
        /// <summary>The ERP APIs read (one per company code, or the organization-wide one).</summary>
        public int Apis { get; set; }
        public int Read { get; set; }
        public int Created { get; set; }
        public int Updated { get; set; }
        public int Unchanged { get; set; }
        public int Invalid { get; set; }
        /// <summary>The first problems found (at most 50).</summary>
        public List<string> Errors { get; set; } = new();
    }
}

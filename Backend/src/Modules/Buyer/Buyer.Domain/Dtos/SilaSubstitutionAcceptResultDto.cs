namespace Buyer.Domain.Dtos
{
    /// <summary>The recipe version the accepted proposal created and sent for approval.</summary>
    public class SilaSubstitutionAcceptResultDto
    {
        public Guid ProposalId { get; set; }
        public Guid RecipeId { get; set; }
        public string RecipeCode { get; set; } = string.Empty;
        public int Version { get; set; }
        /// <summary>Open proposals of the same recipe and property closed by this decision (this one included).</summary>
        public int ProposalsClosed { get; set; }
    }
}

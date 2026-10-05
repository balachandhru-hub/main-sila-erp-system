namespace Buyer.Domain.Dtos
{
    /// <summary>One page of recipe substitution proposals.</summary>
    public class SilaSubstitutionPageDto
    {
        public List<SilaSubstitutionListItemDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; }
    }
}

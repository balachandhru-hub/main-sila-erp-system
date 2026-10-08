namespace Buyer.Domain.Dtos
{
    /// <summary>One row of the shortage report grouped by location or by justification category.</summary>
    public class SilaShortageGroupDto
    {
        public string Key { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public int Lines { get; set; }
        public decimal ShortageQty { get; set; }
        public decimal ShortageValue { get; set; }
        public decimal PostedValue { get; set; }
    }
}

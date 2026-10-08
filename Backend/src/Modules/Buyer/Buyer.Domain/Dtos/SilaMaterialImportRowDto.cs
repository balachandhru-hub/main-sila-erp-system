namespace Buyer.Domain.Dtos
{
    /// <summary>One row of a material Excel import: what it does (CHANGE, UNCHANGED, CONVERSION, INVALID) and why.</summary>
    public class SilaMaterialImportRowDto
    {
        public string Sheet { get; set; } = string.Empty;
        public int RowNumber { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        /// <summary>True when the row requests a new unit price (it goes through approval).</summary>
        public bool PriceChange { get; set; }
        public List<string> Messages { get; set; } = new();
    }
}

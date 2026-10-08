namespace Buyer.Domain.Dtos
{
    /// <summary>One row of a location import preview.</summary>
    public class SilaLocationImportRowDto
    {
        public int RowNumber { get; set; }
        public string LocationCode { get; set; } = string.Empty;
        public string LocationName { get; set; } = string.Empty;
        public string LocationType { get; set; } = string.Empty;
        /// <summary>NEW | UPDATE | UNCHANGED | INVALID</summary>
        public string Action { get; set; } = string.Empty;
        public List<string> Errors { get; set; } = new();
    }
}

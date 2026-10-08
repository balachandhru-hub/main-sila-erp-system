namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Outcome of an outlet or item mapping import. The preview (Imported = false) validates every row; the confirm call
    /// imports all rows or none (any invalid row blocks the import).
    /// </summary>
    public class SilaPosMappingImportDto
    {
        public string FileName { get; set; } = string.Empty;
        public int TotalRows { get; set; }
        public int NewRows { get; set; }
        public int ChangedRows { get; set; }
        public int UnchangedRows { get; set; }
        public int InvalidRows { get; set; }
        public bool Imported { get; set; }
        public List<SilaPosRowErrorDto> Errors { get; set; } = new();
    }
}

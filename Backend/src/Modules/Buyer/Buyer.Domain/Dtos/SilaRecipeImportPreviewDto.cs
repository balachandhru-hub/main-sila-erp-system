namespace Buyer.Domain.Dtos
{
    /// <summary>The result of an Excel import preview (nothing saved) or of the confirmed import (Imported = true).</summary>
    public class SilaRecipeImportPreviewDto
    {
        public string FileName { get; set; } = string.Empty;
        public int TotalRows { get; set; }
        public int ValidRows { get; set; }
        public int InvalidRows { get; set; }
        /// <summary>Records (recipes, families or categories) that would be created.</summary>
        public int NewCount { get; set; }
        public int ChangedCount { get; set; }
        public int UnchangedCount { get; set; }
        public bool Imported { get; set; }
        public List<SilaRecipeImportErrorDto> Errors { get; set; } = new();
    }
}

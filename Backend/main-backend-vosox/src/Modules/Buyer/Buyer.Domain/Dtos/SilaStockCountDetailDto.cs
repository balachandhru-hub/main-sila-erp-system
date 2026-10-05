namespace Buyer.Domain.Dtos
{
    public class SilaStockCountDetailDto
    {
        public Guid Id { get; set; }
        public string CountNumber { get; set; } = string.Empty;
        public Guid LocationId { get; set; }
        public string? LocationName { get; set; }
        public string CountType { get; set; } = string.Empty;
        public bool BlindCount { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Notes { get; set; }
        /// <summary>False while a blind count is in progress for a user without full access: system and variance figures are hidden.</summary>
        public bool CanSeeSystemQty { get; set; }
        public int TotalItems { get; set; }
        public int CountedItems { get; set; }
        public int RemainingItems { get; set; }
        public int MatchedItems { get; set; }
        public int ShortageItems { get; set; }
        public int SurplusItems { get; set; }
        public decimal? ShortageValue { get; set; }
        public Guid CreatedBy { get; set; }
        public DateTime DateCreated { get; set; }
        public Guid? SubmittedBy { get; set; }
        public DateTime? SubmittedOn { get; set; }
        public Guid? ApprovedBy { get; set; }
        public DateTime? ApprovedOn { get; set; }
        public Guid? PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public DateTime? BusinessDate { get; set; }
        public string? Currency { get; set; }
        public string? CreatedByName { get; set; }
        public string? SubmittedByName { get; set; }
        public string? ApprovedByName { get; set; }
        public List<SilaStockCountItemDto> Items { get; set; } = new List<SilaStockCountItemDto>();
    }
}

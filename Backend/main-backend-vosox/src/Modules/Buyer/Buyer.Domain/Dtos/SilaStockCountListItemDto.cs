namespace Buyer.Domain.Dtos
{
    public class SilaStockCountListItemDto
    {
        public Guid Id { get; set; }
        public string CountNumber { get; set; } = string.Empty;
        public Guid LocationId { get; set; }
        public string? LocationName { get; set; }
        public string CountType { get; set; } = string.Empty;
        public bool BlindCount { get; set; }
        public string Status { get; set; } = string.Empty;
        public int TotalItems { get; set; }
        public int CountedItems { get; set; }
        public int ShortageItems { get; set; }
        public int SurplusItems { get; set; }
        public DateTime DateCreated { get; set; }
        public DateTime? SubmittedOn { get; set; }
        public DateTime? ApprovedOn { get; set; }
        public Guid? PropertyId { get; set; }
        public string? PropertyName { get; set; }
        public DateTime? BusinessDate { get; set; }

        /// <summary>Zero for a blind count the caller may not see.</summary>
        public int MatchedItems { get; set; }

        /// <summary>Value of the shortage lines; null for a blind count the caller may not see.</summary>
        public decimal? ShortageValue { get; set; }
        public string? Currency { get; set; }
        public Guid CreatedBy { get; set; }
        public string? CreatedByName { get; set; }
    }
}

namespace Buyer.Domain.Dtos
{
    /// <summary>One shortage line of a submitted stock count with its enquiry and review.</summary>
    public class SilaShortageLineDto
    {
        public Guid StockCountId { get; set; }
        public string CountNumber { get; set; } = string.Empty;
        public string CountType { get; set; } = string.Empty;
        public string CountStatus { get; set; } = string.Empty;
        public Guid LocationId { get; set; }
        public string? LocationName { get; set; }
        public DateTime? SubmittedOn { get; set; }
        public DateTime? ApprovedOn { get; set; }
        public Guid StockCountItemId { get; set; }
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string Uom { get; set; } = string.Empty;
        public decimal SystemQty { get; set; }
        public decimal? CountedQty { get; set; }
        /// <summary>Positive quantity missing.</summary>
        public decimal ShortageQty { get; set; }
        public decimal? UnitCost { get; set; }
        public decimal ShortageValue { get; set; }
        public Guid? EnquiryId { get; set; }
        public string? EnquiryNumber { get; set; }
        public string? EnquiryStatus { get; set; }
        public string? JustificationCategory { get; set; }
        public string? Response { get; set; }
        public string? ReviewStatus { get; set; }
        public string? ReviewComment { get; set; }
        public bool Posted { get; set; }
        public string? PropertyName { get; set; }

        /// <summary>Manager(s) assigned to the count location.</summary>
        public string? Manager { get; set; }

        /// <summary>Status of the count's ERP posting for a posted line, else null.</summary>
        public string? SapStatus { get; set; }
        public string? SapMaterialDocument { get; set; }
        public string? SapError { get; set; }
    }
}

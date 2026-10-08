namespace Buyer.Domain.Dtos
{
    public class SilaEnquiryDto
    {
        public Guid Id { get; set; }
        public string EnquiryNumber { get; set; } = string.Empty;
        public Guid StockCountId { get; set; }
        public string? CountNumber { get; set; }
        public Guid StockCountItemId { get; set; }
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public Guid LocationId { get; set; }
        public string? LocationName { get; set; }
        public decimal ShortageQty { get; set; }
        public string Uom { get; set; } = string.Empty;
        public decimal? ShortageValue { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? JustificationCategory { get; set; }
        public string? Response { get; set; }
        public string? ReviewComment { get; set; }
        public Guid? RespondedBy { get; set; }
        public DateTime? RespondedOn { get; set; }
        public Guid? ReviewedBy { get; set; }
        public DateTime? ReviewedOn { get; set; }
        public DateTime DateCreated { get; set; }
        /// <summary>Timeline; filled on the detail only.</summary>
        public List<SilaEnquiryEventDto> Events { get; set; } = new List<SilaEnquiryEventDto>();
    }
}

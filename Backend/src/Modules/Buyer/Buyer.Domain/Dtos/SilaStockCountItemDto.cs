namespace Buyer.Domain.Dtos
{
    public class SilaStockCountItemDto
    {
        public Guid Id { get; set; }
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public string? Barcode { get; set; }
        public string BaseUom { get; set; } = string.Empty;
        /// <summary>The base unit plus every unit the material converts from, for the count entry.</summary>
        public List<string> Uoms { get; set; } = new List<string>();
        public decimal? SystemQty { get; set; }
        public decimal? CountedQty { get; set; }
        public decimal? VarianceQty { get; set; }
        public decimal? UnitCost { get; set; }
        public decimal? VarianceValue { get; set; }
        public string? CountMethod { get; set; }
        public string Status { get; set; } = string.Empty;
        public Guid? CountedBy { get; set; }
        public DateTime? CountedOn { get; set; }
        public string? CountedByName { get; set; }

        /// <summary>Manager(s) assigned to the count location.</summary>
        public string? Manager { get; set; }

        /// <summary>ERP posting of the variance: PENDING | POSTED | FAILED | SKIPPED | UNKNOWN; null when nothing is posted.</summary>
        public string? SapStatus { get; set; }
        public string? SapMaterialDocument { get; set; }
        public string? SapError { get; set; }
        /// <summary>The cost controller asked for this line to be counted again.</summary>
        public bool RecountRequested { get; set; }
        /// <summary>ACCEPTED, REJECTED or MORE_INFORMATION_REQUIRED; null while not reviewed.</summary>
        public string? ReviewStatus { get; set; }
        public string? ReviewComment { get; set; }
        public Guid? EnquiryId { get; set; }
        public string? EnquiryNumber { get; set; }
        public string? EnquiryStatus { get; set; }
        public List<SilaStockCountPhotoDto> Photos { get; set; } = new List<SilaStockCountPhotoDto>();
    }
}

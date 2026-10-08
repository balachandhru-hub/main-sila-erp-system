using Buyer.Domain.Dtos;

namespace Buyer.Application.Features.Shared
{
    /// <summary>One row of the Materials sheet of the material Excel file, as read.</summary>
    public class SilaMaterialExcelRow
    {
        public int RowNumber { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public SilaMaterialInventoryWriteDto Fields { get; set; } = new();
        public decimal? NewUnitPrice { get; set; }
        public string? Currency { get; set; }
        public string? PriceUom { get; set; }
        public string? PriceReason { get; set; }
        public DateTime? EffectiveFrom { get; set; }
        public List<string> Errors { get; set; } = new();
    }

    /// <summary>One row of the Conversions sheet: 1 FromUom = Factor ToUom.</summary>
    public class SilaConversionExcelRow
    {
        public int RowNumber { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string FromUom { get; set; } = string.Empty;
        public decimal Factor { get; set; }
        public string ToUom { get; set; } = string.Empty;
        public List<string> Errors { get; set; } = new();
    }
}

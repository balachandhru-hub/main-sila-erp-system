namespace Buyer.Domain.Dtos
{
    /// <summary>1 FromUom = Factor ToUom, e.g. 1 BTL = 750 ML.</summary>
    public class SilaUomConversionDto
    {
        public Guid Id { get; set; }
        public string FromUom { get; set; } = string.Empty;
        public string ToUom { get; set; } = string.Empty;
        public decimal Factor { get; set; }
    }
}

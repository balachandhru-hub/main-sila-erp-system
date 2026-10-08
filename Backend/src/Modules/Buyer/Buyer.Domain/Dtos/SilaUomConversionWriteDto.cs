namespace Buyer.Domain.Dtos
{
    /// <summary>1 FromUom = Factor ToUom. One of the two units must be the material's base unit.</summary>
    public class SilaUomConversionWriteDto
    {
        public string FromUom { get; set; } = string.Empty;
        public string ToUom { get; set; } = string.Empty;
        public decimal Factor { get; set; }
    }
}

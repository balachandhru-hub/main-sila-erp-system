namespace Buyer.Domain.Dtos
{
    /// <summary>Which company code's materials to pull from the ERP (GET_MATERIAL).</summary>
    public class SilaMaterialErpPullWriteDto
    {
        public string CompanyCode { get; set; } = string.Empty;
    }
}

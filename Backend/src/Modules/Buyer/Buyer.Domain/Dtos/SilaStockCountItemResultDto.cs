namespace Buyer.Domain.Dtos
{
    public class SilaStockCountItemResultDto
    {
        public SilaStockCountItemDto Item { get; set; } = new SilaStockCountItemDto();
        public string Message { get; set; } = string.Empty;
    }
}

namespace Buyer.Domain.Dtos
{
    public class SilaPosTransactionPageDto
    {
        public List<SilaPosTransactionDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; }
    }
}

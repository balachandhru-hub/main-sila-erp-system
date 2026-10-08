namespace Buyer.Domain.Dtos
{
    /// <summary>One page of a POS list (index = rows skipped).</summary>
    public class SilaPosPageDto<T>
    {
        public List<T> Items { get; set; } = new();
        public int Total { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; }
    }
}

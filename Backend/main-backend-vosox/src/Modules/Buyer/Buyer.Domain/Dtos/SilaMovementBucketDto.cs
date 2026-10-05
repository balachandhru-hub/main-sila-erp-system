namespace Buyer.Domain.Dtos
{
    /// <summary>Today's movements of one kind (received, consumed, transferred, waste, adjustments).</summary>
    public class SilaMovementBucketDto
    {
        public string Key { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public int Count { get; set; }
        public decimal Value { get; set; }

        public string Note { get; set; } = string.Empty;

        /// <summary>False when the data source of the bucket is not set up (e.g. consumption without a POS source).</summary>
        public bool Configured { get; set; } = true;
    }
}

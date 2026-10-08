namespace Buyer.Domain.Dtos
{
    /// <summary>Stocked materials by health against their stocking levels.</summary>
    public class SilaStockHealthDto
    {
        public int Healthy { get; set; }
        public int Low { get; set; }
        public int Out { get; set; }
        /// <summary>Above the par level.</summary>
        public int Excess { get; set; }

        /// <summary>False when no expiry-managed material is in stock in scope (near-expiry cannot be shown).</summary>
        public bool NearExpiryConfigured { get; set; }
        public string NearExpiryNote { get; set; } = string.Empty;

        /// <summary>Expiry-managed materials with stock on hand in scope.</summary>
        public int ExpiryManagedInStock { get; set; }
    }
}

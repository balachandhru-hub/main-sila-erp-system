namespace SharedKernel.Tenancy
{
    /// <summary>
    /// The modules a customer realm can be licensed for, and which API features belong to each.
    /// </summary>
    public static class ModuleCatalog
    {
        /// <summary>RFQ, auctions, contracts, catalogs, approvals. Part of every realm.</summary>
        public const string SOURCING = "SOURCING";

        /// <summary>Buying platform: cart, wishlists, outlets, purchase order hand-off.</summary>
        public const string BUYING = "BUYING";

        public static readonly IReadOnlyList<string> All = new[] { SOURCING, BUYING };

        /// <summary>
        /// The module a feature key belongs to, or null when the feature is part of the base platform.
        /// </summary>
        public static string? RequiredModule(string? featureKey)
        {
            if (string.IsNullOrWhiteSpace(featureKey))
            {
                return null;
            }

            string key = featureKey.ToUpperInvariant();
            if (key.Contains("WISHLIST", StringComparison.Ordinal) || key.EndsWith("_OUTLET", StringComparison.Ordinal))
            {
                return BUYING;
            }

            return null;
        }
    }
}

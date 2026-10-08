namespace SharedKernel.Integration.Rules
{
    /// <summary>
    /// Description of one API type in the <see cref="IntegrationProcessCatalog"/>.
    /// </summary>
    public sealed class IntegrationProcessInfo
    {
        public string Side { get; init; } = IntegrationProcessCatalog.SIDE_BUYER;

        /// <summary>The application sends data to the API (a purchase order, a sales order).</summary>
        public bool IsPush { get; init; }

        /// <summary>The API can be read by a manual or scheduled pull.</summary>
        public bool CanPull { get; init; }

        /// <summary>Area of the target fields the API's records are mapped to; null when it has no field mapping.</summary>
        public string? MappingArea { get; init; }

        public string[] RequiredTargets { get; init; } = Array.Empty<string>();
    }
}

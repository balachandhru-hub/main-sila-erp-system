namespace Buyer.Domain.Dtos
{
    /// <summary>Number of transfers in one status.</summary>
    public class SilaTransferStageDto
    {
        public string Status { get; set; } = string.Empty;
        public int Count { get; set; }

        public string Label { get; set; } = string.Empty;

        /// <summary>The transfer list tab that shows these transfers: to-approve | in-transit | completed.</summary>
        public string Tab { get; set; } = string.Empty;
    }
}

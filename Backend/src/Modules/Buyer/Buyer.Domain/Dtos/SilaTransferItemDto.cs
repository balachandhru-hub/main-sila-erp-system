namespace Buyer.Domain.Dtos
{
    /// <summary>One transfer line. All quantities are in the base unit of the material.</summary>
    public class SilaTransferItemDto
    {
        public Guid Id { get; set; }
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string MaterialName { get; set; } = string.Empty;
        public decimal RequestedQty { get; set; }
        public decimal ApprovedQty { get; set; }
        public decimal DispatchedQty { get; set; }
        public decimal ReceivedQty { get; set; }
        public string Uom { get; set; } = string.Empty;

        /// <summary>Per base unit: the source balance cost, else the material cost.</summary>
        public decimal? UnitCost { get; set; }
        public decimal? TransferValue { get; set; }

        /// <summary>On hand at the source now.</summary>
        public decimal SourceAvailable { get; set; }

        /// <summary>Source stock once the transfer leaves (equals SourceAvailable after dispatch).</summary>
        public decimal SourceAfter { get; set; }

        /// <summary>Received minus dispatched once received, else null.</summary>
        public decimal? VarianceQty { get; set; }
    }
}

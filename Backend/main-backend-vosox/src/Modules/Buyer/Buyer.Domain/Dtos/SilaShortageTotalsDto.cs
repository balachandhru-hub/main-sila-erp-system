namespace Buyer.Domain.Dtos
{
    /// <summary>Totals of the shortage report. Values use the unit cost captured on the count line.</summary>
    public class SilaShortageTotalsDto
    {
        public int Lines { get; set; }
        public decimal ShortageQty { get; set; }
        public decimal ShortageValue { get; set; }
        /// <summary>Lines the location answered with a justification.</summary>
        public int JustifiedLines { get; set; }
        public decimal JustifiedValue { get; set; }
        public int AcceptedLines { get; set; }
        public decimal AcceptedValue { get; set; }
        public int RejectedLines { get; set; }
        public decimal RejectedValue { get; set; }
        /// <summary>Lines whose variance was posted to inventory (count approved, line not rejected).</summary>
        public int PostedLines { get; set; }
        public decimal PostedValue { get; set; }

        /// <summary>Lines whose enquiry waits for the location's answer (sent or more information required).</summary>
        public decimal AwaitingValue { get; set; }

        /// <summary>Lines neither accepted nor rejected yet.</summary>
        public decimal UnresolvedValue { get; set; }

        /// <summary>Lines of counts the cost controller approved (posted or rejected lines).</summary>
        public decimal ApprovedValue { get; set; }
        public decimal SapPostedValue { get; set; }
        public decimal SapPendingValue { get; set; }
        public decimal SapFailedValue { get; set; }
        public int Locations { get; set; }
        public int Materials { get; set; }
        public string? Currency { get; set; }
    }
}
